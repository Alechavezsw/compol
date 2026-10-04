"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { loadQuestions, persistInterview, type IncomingAnswer } from "@/lib/questions";

export type AnswerInput = IncomingAnswer;

export type SubmitResult = { ok: boolean; status?: "completada" | "descartada"; error?: string };

/** Guarda una entrevista de campo. Las reglas viven en `persistInterview`. */
export async function submitResponseAction(payload: {
  surveyId: string;
  zone: string | null;
  durationSeconds: number;
  answers: AnswerInput[];
  latitude?: number | null;
  longitude?: number | null;
}): Promise<SubmitResult> {
  const { profile } = await requireRole(["surveyor"]);
  const { surveyId, zone, durationSeconds, answers } = payload;

  if (!surveyId) return { ok: false, error: "Falta la encuesta." };
  if (!Array.isArray(answers)) return { ok: false, error: "Formato de respuestas inválido." };

  const supabase = await createClient();

  const [{ data: survey }, { data: assignment }] = await Promise.all([
    supabase.from("surveys").select("id, status, organization_id").eq("id", surveyId).maybeSingle(),
    supabase
      .from("survey_assignments")
      .select("id")
      .eq("survey_id", surveyId)
      .eq("surveyor_id", profile.id)
      .maybeSingle(),
  ]);

  if (!survey) return { ok: false, error: "No se encontró la encuesta." };
  // RLS ya lo impide en la base; lo chequeamos igual para dar un mensaje claro.
  if (!assignment) return { ok: false, error: "No tenés asignada esta encuesta." };
  if (survey.status !== "activa") {
    return { ok: false, error: "La encuesta no está en campo en este momento." };
  }

  const result = await persistInterview(supabase, {
    survey,
    questions: await loadQuestions(supabase, surveyId),
    answers,
    meta: {
      channel: "campo",
      surveyor_id: profile.id,
      zone,
      duration_seconds: durationSeconds,
      latitude: payload.latitude,
      longitude: payload.longitude,
    },
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/campo");
  revalidatePath(`/campo/encuestas/${surveyId}`);
  return { ok: true, status: result.status };
}
