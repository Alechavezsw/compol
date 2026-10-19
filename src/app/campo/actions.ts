"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { loadQuestions, persistInterview, type IncomingAnswer } from "@/lib/questions";
import { isExpired } from "@/lib/survey-status";
import { formatDate } from "@/lib/utils";

export type AnswerInput = IncomingAnswer;

/**
 * `permanent` marca un rechazo que reintentar no arregla (encuesta cerrada,
 * pausada, no asignada). El cliente lo usa para no frenar el resto de la cola.
 */
export type SubmitResult = { ok: boolean; status?: "completada" | "descartada"; error?: string; permanent?: boolean };

const MAX_OFFLINE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Una entrevista guardada sin señal vale con la fecha en que se tomó, no con la
 * del envío: si el encuestador la hizo antes del cierre y la sincroniza después,
 * no se pierde. La hora la manda el teléfono, así que se acota a los últimos 14 días.
 */
function collectedWhen(collectedAt: unknown, now = Date.now()) {
  if (typeof collectedAt !== "number" || !Number.isFinite(collectedAt)) return now;
  if (collectedAt > now || now - collectedAt > MAX_OFFLINE_AGE_MS) return now;
  return collectedAt;
}

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
    },
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/campo");
  revalidatePath(`/campo/encuestas/${surveyId}`);
  return { ok: true, status: result.status };
}
