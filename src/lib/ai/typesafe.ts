import "server-only";
import type { Emotion, SentimentLabel } from "@/lib/types";
import { isAiGatewayConfigured } from "@/lib/ai/gateway";
import { type JevContext, jevRequest, jevRow } from "../../../supabase/functions/_shared/jev";

export const DEFAULT_TYPESAFE_MODEL = process.env.TYPESAFE_MODEL || "jev-latest";

export function hasLocalTypesafeKey() {
  const key = process.env.TYPESAFE_API_KEY;
  return Boolean(key && key.length >= 20 && !key.includes("..."));
}

export function isTypesafeConfigured() {
  return isAiGatewayConfigured() || hasLocalTypesafeKey();
}

async function callSystemOne(body: ReturnType<typeof jevRequest>): Promise<unknown> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("Falta TYPESAFE_API_KEY.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`TypeSafe respondió ${res.status}.`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** No hay límite de uso documentado: se acota la concurrencia entre publicaciones por las dudas. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export type TypesafeRow = {
  index: number;
  sentiment: number;
  label: SentimentLabel;
  emotion: Emotion | null;
  topics: string[];
  provider?: "jev" | "gemini" | "typesafe";
};

/**
 * Clasifica publicaciones con TypeSafe: una llamada por publicación (así
 * espera la API su "state"), con sentimiento, emoción y cada tema como
 * preguntas paralelas de la misma llamada. Si una publicación falla, esa
 * fila vuelve `null` y quien llama la deja con la clasificación del léxico.
 */
export async function classifySocialBatchTypesafe(
  texts: string[],
  topics: string[],
  context: JevContext = {},
): Promise<(TypesafeRow | null)[]> {
  return mapWithConcurrency(texts, 8, async (text, index) => {
    try {
      return jevRow(index, await callSystemOne(jevRequest(DEFAULT_TYPESAFE_MODEL, text, topics, context)), topics);
    } catch {
      return null;
    }
  });
}
