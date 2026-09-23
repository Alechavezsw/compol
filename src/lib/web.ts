import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { loadQuestions } from "@/lib/questions";
import type { QuestionWithOptions, Survey, WebSettings, WidgetMode } from "@/lib/types";

export const WIDGET_MODES: WidgetMode[] = ["inline", "flotante", "emergente"];

/** Valores por defecto de la experiencia web, para no guardar nulos en la base. */
export function resolveWebSettings(survey: Pick<Survey, "title" | "description" | "web_settings">) {
  const s: WebSettings = survey.web_settings ?? {};
  const accent = /^#[0-9a-f]{6}$/i.test(s.accent ?? "") ? (s.accent as string) : "#3d2de0";
  return {
    accent,
    welcomeTitle: s.welcome_title?.trim() || survey.title,
    welcomeText: s.welcome_text?.trim() || survey.description || "Tu respuesta es anónima y lleva pocos minutos.",
    thanksTitle: s.thanks_title?.trim() || "¡Gracias por responder!",
    thanksText: s.thanks_text?.trim() || "Tu opinión ya quedó registrada.",
    buttonLabel: s.button_label?.trim() || "Responder encuesta",
    mode: WIDGET_MODES.includes(s.mode as WidgetMode) ? (s.mode as WidgetMode) : "flotante",
    onePerDevice: s.one_per_device ?? true,
    popupDelay: Math.min(120, Math.max(0, Number(s.popup_delay ?? 6) || 0)),
  };
}

export type ResolvedWebSettings = ReturnType<typeof resolveWebSettings>;

export type PublicSurvey = {
  survey: Survey;
  questions: QuestionWithOptions[];
  settings: ResolvedWebSettings;
  organizationName: string | null;
};

/**
 * Busca una encuesta por su token público. Corre con la service role porque
 * quien responde no tiene sesión; por eso filtra explícitamente por
 * `web_enabled` y nunca devuelve datos de respuestas.
 */
export async function loadPublicSurvey(token: string): Promise<PublicSurvey | null> {
  if (!/^[\w-]{6,64}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: survey } = await admin
    .from("surveys")
    .select("*")
    .eq("public_token", token)
    .eq("web_enabled", true)
    .maybeSingle();
  if (!survey) return null;

  const [questions, { data: org }] = await Promise.all([
    loadQuestions(admin, survey.id),
    admin.from("organizations").select("name").eq("id", survey.organization_id).maybeSingle(),
  ]);

  return {
    survey: survey as Survey,
    questions,
    settings: resolveWebSettings(survey as Survey),
    organizationName: (org as { name: string } | null)?.name ?? null,
  };
}

/** Solo origen y ruta: la query de la página que embebe puede traer datos personales. */
export function sanitizeSourceUrl(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

/**
 * Huella anónima del dispositivo: hash del token + id aleatorio que guarda el
 * navegador + user agent. No identifica a nadie y cambia por encuesta, pero
 * alcanza para frenar el "respondo diez veces seguidas".
 */
export function respondentHash(token: string, deviceId: string, userAgent: string) {
  return createHash("sha256").update(`${token}|${deviceId}|${userAgent}`).digest("hex").slice(0, 40);
}

// --- Límite de frecuencia -------------------------------------------------
// En memoria del proceso: suficiente para frenar ráfagas desde una misma IP en
// una instancia. En producción con varias instancias conviene moverlo a la
// base o a un KV compartido.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 12;
const KEY = Symbol.for("consulta.web.ratelimit");
type Holder = { [KEY]?: Map<string, number[]> };

export function rateLimited(key: string) {
  const holder = globalThis as unknown as Holder;
  const buckets = (holder[KEY] ??= new Map<string, number[]>());
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) {
    for (const [k, times] of buckets) if (!times.some((t) => now - t < WINDOW_MS)) buckets.delete(k);
  }
  return false;
}

/** Token corto y difícil de adivinar para publicar una encuesta. */
export function newPublicToken(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const random = createHash("sha256").update(`${title}${Date.now()}${Math.random()}`).digest("base64url").slice(0, 8);
  return `${slug || "encuesta"}-${random}`;
}
