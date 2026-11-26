import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo/mode";
import type { GeneratedReport } from "@/lib/ai/gemini";
import type { TypesafeRow } from "@/lib/ai/typesafe";
import type { TopicHint } from "../../../supabase/functions/_shared/jev";

export function isAiGatewayConfigured() {
  return isSupabaseConfigured();
}

type AiErrorBody = { error?: string };

/** Errores de facturación / crédito prepago de Gemini. */
export function isGeminiBillingError(message: string) {
  return /prepayment credits are depleted|créditos prepago|ai\.studio|billing#prepay|RESOURCE_EXHAUSTED|quota|insufficient.?credit/i.test(
    message,
  );
}

export function humanizeAiError(message: string) {
  if (isGeminiBillingError(message)) {
    return "Los créditos prepago de Gemini están agotados. Recargá en AI Studio (ai.studio) o usá una clave con saldo.";
  }
  if (/Edge Function returned a non-2xx/i.test(message)) {
    return "La capa de IA respondió con error. Revisá los secretos de la función ai o los créditos de Gemini.";
  }
  return message;
}

async function readInvokeError(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === "object" && data !== null && "error" in data) {
    const msg = (data as AiErrorBody).error;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }

  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : null;

  if (ctx && typeof Response !== "undefined" && ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as AiErrorBody;
      if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
    } catch {
      try {
        const text = await (ctx as Response).clone().text();
        if (text.trim()) return text.trim().slice(0, 400);
      } catch {
        // seguimos con el mensaje del cliente
      }
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return "La capa de IA no respondió.";
}

async function invokeAiLayer<T>(body: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("ai", { body });
  const payload = data as (T & AiErrorBody) | null;

  if (error) {
    const raw = await readInvokeError(error, payload);
    throw new Error(humanizeAiError(raw));
  }
  if (payload && typeof payload === "object" && payload.error) {
    throw new Error(humanizeAiError(payload.error));
  }
  if (!payload) throw new Error("La capa de IA no devolvió datos.");
  return payload;
}

export type AiLayerStatus = {
  gemini: boolean;
  jev: boolean;
  geminiModel: string | null;
  jevModel: string | null;
};

export async function getAiLayerStatus(): Promise<AiLayerStatus> {
  return invokeAiLayer<AiLayerStatus>({ action: "status" });
}

/** La función Edge acepta hasta 250 textos por pedido (ver supabase/functions/ai). */
const CLASSIFY_CHUNK = 200;

export async function classifyViaGateway(
  texts: string[],
  topics: string[],
  organizationId?: string,
  /** Qué entra en cada tema: ayuda a JEV a reconocerlos. */
  topicHints: TopicHint[] = [],
) {
  // Las importaciones grandes se mandan en tandas: la función rechaza pedidos más
  // grandes, y la fila `i` de la respuesta tiene que seguir siendo la del texto `i`.
  const rows: (TypesafeRow | null)[] = [];
  for (let start = 0; start < texts.length; start += CLASSIFY_CHUNK) {
    const data = await invokeAiLayer<{ rows: (TypesafeRow | null)[] }>({
      action: "classify",
      texts: texts.slice(start, start + CLASSIFY_CHUNK),
      topics,
      topic_hints: topicHints,
      organization_id: organizationId ?? null,
    });
    rows.push(...data.rows);
  }
  return rows;
}

export async function generateReportViaGateway(params: {
  briefing: string;
  organizationName: string;
  kind: string;
  audience?: string | null;
  focus?: string | null;
  socialSummary?: string;
  organizationId?: string;
}): Promise<GeneratedReport> {
  return invokeAiLayer<GeneratedReport>({
    action: "report",
    briefing: params.briefing,
    organizationName: params.organizationName,
    kind: params.kind,
    audience: params.audience ?? null,
    focus: params.focus ?? null,
    socialSummary: params.socialSummary ?? null,
    organization_id: params.organizationId ?? null,
  });
}

export async function askViaGateway(params: {
  briefing: string;
  question: string;
  organizationId?: string;
}): Promise<{ answer: string; model: string }> {
  return invokeAiLayer<{ answer: string; model: string }>({
    action: "ask",
    briefing: params.briefing,
    question: params.question,
    organization_id: params.organizationId ?? null,
  });
}
