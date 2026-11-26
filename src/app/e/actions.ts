"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { persistInterview, type IncomingAnswer } from "@/lib/questions";
import {
  connectionLimited,
  loadPublicSurvey,
  publicAcceptsResponses,
  rateLimited,
  respondentHash,
  sanitizeSourceUrl,
} from "@/lib/web";
import { MIN_FORM_SECONDS, connectionHash, formAgeSeconds } from "@/lib/web-guard";

export type WebSubmitResult = { ok: boolean; status?: "completada" | "descartada"; error?: string; duplicate?: boolean };

/**
 * Envío de una respuesta web. Sin sesión, así que todo se valida acá: token,
 * estado de la encuesta y de su organización, límite por conexión (en memoria y
 * en la base), una respuesta por dispositivo, que el formulario lleve abierto un
 * tiempo razonable según el RELOJ DEL SERVIDOR (token firmado: un bot no puede
 * declarar que tardó) y el cuestionario completo con las mismas reglas que el campo.
 */
export async function submitWebResponseAction(payload: {
  token: string;
  answers: IncomingAnswer[];
  durationSeconds: number;
  deviceId: string;
  sourceUrl: string | null;
  /** Token firmado que emitió la página al cargarse. */
  formToken: string;
  /** Campo trampa: invisible para personas, los bots lo completan. */
  website?: string;
}): Promise<WebSubmitResult> {
  const survey = await loadPublicSurvey(String(payload.token ?? ""));
  if (!survey) return { ok: false, error: "Esta encuesta no está disponible." };
  if (!publicAcceptsResponses(survey)) return { ok: false, error: "La encuesta ya no recibe respuestas." };

  // Al bot le decimos que salió bien: no aprende qué lo delató.
  if (payload.website) return { ok: true, status: "completada" };
  if (!Array.isArray(payload.answers)) return { ok: false, error: "Formato de respuestas inválido." };

  const age = formAgeSeconds(survey.survey.public_token ?? "", payload.formToken);
  if (age === null) return { ok: false, error: "La página venció. Recargala para responder." };
  if (age < MIN_FORM_SECONDS) return { ok: false, error: "Tomate un momento para leer las preguntas." };

  const h = await headers();
  // En Vercel `x-vercel-forwarded-for` lo fija la plataforma; `x-forwarded-for` puede venir
  // con valores que puso el cliente, así que es el último recurso.
  const ip =
    h.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "local";
  const tooMany = { ok: false, error: "Recibimos demasiadas respuestas desde esta conexión. Probá más tarde." };
  if (rateLimited(`${survey.survey.id}:${ip}`)) return tooMany;

  const deviceId = /^[\w-]{8,64}$/.test(payload.deviceId ?? "") ? payload.deviceId : "sin-dispositivo";
  const hash = respondentHash(survey.survey.public_token ?? "", deviceId, h.get("user-agent") ?? "");
  const admin = createAdminClient();

  // Sin cabecera de IP (desarrollo local) no hay conexión que contar: todos compartirían cubo.
  const ipHash = ip === "local" ? null : connectionHash(survey.survey.id, ip);
  if (ipHash && (await connectionLimited(admin, survey.survey.id, ipHash))) return tooMany;

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

  // La duración que declara el navegador no puede superar lo que el servidor vio pasar.
  const claimed = Number(payload.durationSeconds);
  const duration = Math.min(Number.isFinite(claimed) ? Math.max(0, claimed) : 0, Math.ceil(age), 60 * 60 * 3);

  const result = await persistInterview(admin, {
    survey: survey.survey,
    questions: survey.questions,
    answers: payload.answers,
    meta: {
      channel: "web",
      surveyor_id: null,
      zone: null,
      duration_seconds: duration,
      source_url: sanitizeSourceUrl(payload.sourceUrl),
      respondent_hash: hash,
      ip_hash: ipHash,
    },
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/cliente/encuestas/${survey.survey.id}/resultados`);
  return { ok: true, status: result.status };
}
