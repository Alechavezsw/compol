import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo/mode";
import type { GeneratedReport } from "@/lib/ai/gemini";
import type { TypesafeRow } from "@/lib/ai/typesafe";

export function isAiGatewayConfigured() {
  return isSupabaseConfigured();
}

type AiErrorBody = { error?: string };

async function invokeAiLayer<T>(body: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("ai", { body });
  const payload = data as (T & AiErrorBody) | null;

  if (error) {
    throw new Error(payload?.error || error.message || "La capa de IA no respondió.");
  }
  if (payload && typeof payload === "object" && payload.error) {
    throw new Error(payload.error);
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

export async function classifyViaGateway(texts: string[], topics: string[], organizationId?: string) {
  const data = await invokeAiLayer<{ rows: (TypesafeRow | null)[] }>({
    action: "classify",
    texts,
    topics,
    organization_id: organizationId ?? null,
  });
  return data.rows;
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
