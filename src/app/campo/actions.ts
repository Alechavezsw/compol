"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { loadQuestions, persistInterview, type IncomingAnswer } from "@/lib/questions";
import { collectedWhen, isExpired } from "@/lib/survey-status";
import { formatDate } from "@/lib/utils";

export type AnswerInput = IncomingAnswer;

async function findPrior(supabase: Awaited<ReturnType<typeof createClient>>, surveyId: string, respondentHash: string) {
  const { data } = await supabase
    .from("responses")
    .select("id, status")
    .eq("survey_id", surveyId)
    .eq("respondent_hash", respondentHash)
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * `permanent` marca un rechazo que reintentar no arregla (encuesta cerrada,
 * pausada, no asignada). `rejected` es el caso de la entrevista misma: el
 * cuestionario cambió y ya no la acepta. Con cualquiera de los dos el cliente
 * sigue con el resto de la cola en vez de frenarla.
 */
export type SubmitResult = {
  ok: boolean;
  status?: "completada" | "descartada";
  error?: string;
  permanent?: boolean;
  rejected?: boolean;
};

/** Guarda una entrevista de campo. Las reglas viven en `persistInterview`. */
export async function submitResponseAction(payload: {
  surveyId: string;
  zone: string | null;
  durationSeconds: number;
  answers: AnswerInput[];
  latitude?: number | null;
  longitude?: number | null;
  /** Momento (ms) en que se tomó la entrevista, si salió de la cola sin conexión. */
  collectedAt?: number;
  /** Id que genera el teléfono para que un envío repetido no cree una segunda entrevista. */
  clientId?: string;
}): Promise<SubmitResult> {
  const { profile } = await requireRole(["surveyor"]);
  const { surveyId, zone, durationSeconds, answers } = payload;

  if (!surveyId) return { ok: false, error: "Falta la encuesta." };
  if (!Array.isArray(answers)) return { ok: false, error: "Formato de respuestas inválido." };
  // Llega desde el navegador (y desde la cola offline): se valida igual que en la encuesta web.
  if (typeof surveyId !== "string" || !Number.isFinite(durationSeconds)) {
    return { ok: false, error: "Los datos de la entrevista no son válidos." };
  }

  const supabase = await createClient();

  // Idempotencia: si la señal se cortó justo después de guardar, el teléfono repite el
  // envío. Se reconoce por el id que generó y se responde "ok" sin duplicar la entrevista.
  // Va antes de mirar el estado de la encuesta: una entrevista ya guardada no se rechaza
  // porque la encuesta cerró mientras tanto.
  const clientKey = typeof payload.clientId === "string" && /^[\w-]{8,64}$/.test(payload.clientId) ? payload.clientId : null;
  const respondentHash = clientKey
    ? createHash("sha256").update(`campo|${profile.id}|${clientKey}`).digest("hex").slice(0, 40)
    : null;
  // Una entrevista que quedó `en_curso` (el envío anterior se cortó antes de cerrarla) NO
  // está guardada: se la reutiliza para completarla en vez de darla por buena y perderla.
  let resumeId: string | null = null;
  if (respondentHash) {
    const prior = await findPrior(supabase, surveyId, respondentHash);
    if (prior?.status === "completada" || prior?.status === "descartada") return { ok: true, status: prior.status };
    if (prior) resumeId = prior.id;
  }

  const [{ data: survey }, { data: assignment }] = await Promise.all([
    supabase.from("surveys").select("id, status, organization_id, ends_at").eq("id", surveyId).maybeSingle(),
    supabase
      .from("survey_assignments")
      .select("id")
      .eq("survey_id", surveyId)
      .eq("surveyor_id", profile.id)
      .maybeSingle(),
  ]);

  if (!survey) return { ok: false, permanent: true, error: "No se encontró la encuesta." };
  // RLS ya lo impide en la base; lo chequeamos igual para dar un mensaje claro.
  if (!assignment) return { ok: false, permanent: true, error: "No tenés asignada esta encuesta." };
  if (survey.status !== "activa") {
    return { ok: false, permanent: true, error: "La encuesta no está en campo en este momento." };
  }
  if (isExpired(survey, collectedWhen(payload.collectedAt))) {
    return {
      ok: false,
      permanent: true,
      error: `La encuesta cerró el ${formatDate(survey.ends_at)}. Pedile a la coordinación que extienda la fecha.`,
    };
  }

  const result = await persistInterview(supabase, {
    survey,
    questions: await loadQuestions(supabase, surveyId),
    answers,
    meta: {
      channel: "campo",
      surveyor_id: profile.id,
      zone,
      duration_seconds: Math.min(durationSeconds, 60 * 60 * 6),
      latitude: payload.latitude,
      longitude: payload.longitude,
      respondent_hash: respondentHash,
      collected_at: collectedWhen(payload.collectedAt),
      resume_response_id: resumeId,
    },
  });

  if (!result.ok) {
    if (result.duplicate && respondentHash) {
      // Otro envío de la misma entrevista llegó primero (la señal volvió justo mientras
      // el teléfono reintentaba). Si ya está cerrada, listo; si todavía se está
      // guardando, se reintenta más tarde en vez de darla por buena.
      const prior = await findPrior(supabase, surveyId, respondentHash);
      if (prior?.status === "completada" || prior?.status === "descartada") return { ok: true, status: prior.status };
      return { ok: false, error: "La entrevista se está guardando. Se reintenta sola." };
    }
    return { ok: false, error: result.error, rejected: result.rejected };
  }

  revalidatePath("/campo");
  revalidatePath(`/campo/encuestas/${surveyId}`);
  return { ok: true, status: result.status };
}
