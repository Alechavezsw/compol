"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { persistInterview, type IncomingAnswer } from "@/lib/questions";
import { loadPublicSurvey, rateLimited, respondentHash, sanitizeSourceUrl } from "@/lib/web";

export type WebSubmitResult = { ok: boolean; status?: "completada" | "descartada"; error?: string; duplicate?: boolean };

/**
 * Envío de una respuesta web. Sin sesión, así que todo se valida acá: token,
 * estado de la encuesta, límite por IP, una respuesta por dispositivo, tiempo
 * mínimo (un bot completa en milisegundos) y el cuestionario completo con las
 * mismas reglas que el campo.
 */
export async function submitWebResponseAction(payload: {
  token: string;
  answers: IncomingAnswer[];
  durationSeconds: number;
  deviceId: string;
  sourceUrl: string | null;
  /** Campo trampa: invisible para personas, los bots lo completan. */
  website?: string;
}): Promise<WebSubmitResult> {
  const survey = await loadPublicSurvey(String(payload.token ?? ""));
  if (!survey) return { ok: false, error: "Esta encuesta no está disponible." };
  if (survey.survey.status !== "activa") return { ok: false, error: "La encuesta ya no recibe respuestas." };

  // Al bot le decimos que salió bien: no aprende qué lo delató.
  if (payload.website) return { ok: true, status: "completada" };
  if (!Array.isArray(payload.answers)) return { ok: false, error: "Formato de respuestas inválido." };
  if (!(payload.durationSeconds >= 3)) return { ok: false, error: "Tomate un momento para leer las preguntas." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  if (rateLimited(`${survey.survey.id}:${ip}`)) {
    return { ok: false, error: "Recibimos demasiadas respuestas desde esta conexión. Probá más tarde." };
  }

  const deviceId = /^[\w-]{8,64}$/.test(payload.deviceId ?? "") ? payload.deviceId : "sin-dispositivo";
  const hash = respondentHash(survey.survey.public_token ?? "", deviceId, h.get("user-agent") ?? "");
  const admin = createAdminClient();

  if (survey.settings.onePerDevice && deviceId !== "sin-dispositivo") {
    const { data: existing } = await admin
      .from("responses")
      .select("id")
      .eq("survey_id", survey.survey.id)
      .eq("respondent_hash", hash)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: false, duplicate: true, error: "Ya respondiste esta encuesta desde este dispositivo." };
  }

  const result = await persistInterview(admin, {
    survey: survey.survey,
    questions: survey.questions,
    answers: payload.answers,
    meta: {
      channel: "web",
      surveyor_id: null,
      zone: null,
      duration_seconds: Math.min(payload.durationSeconds, 60 * 60 * 3),
      source_url: sanitizeSourceUrl(payload.sourceUrl),
      respondent_hash: hash,
    },
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/cliente/encuestas/${survey.survey.id}/resultados`);
  return { ok: true, status: result.status };
}
