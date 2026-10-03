import "server-only";
import type { Emotion, SentimentLabel } from "@/lib/types";
import { isAiGatewayConfigured } from "@/lib/ai/gateway";

export const DEFAULT_TYPESAFE_MODEL = process.env.TYPESAFE_MODEL || "jev-latest";

export function hasLocalTypesafeKey() {
  const key = process.env.TYPESAFE_API_KEY;
  return Boolean(key && key.length >= 20 && !key.includes("..."));
}

export function isTypesafeConfigured() {
  return isAiGatewayConfigured() || hasLocalTypesafeKey();
}

const SENTIMENT_CRITERIA = {
  positivo: "Valora favorablemente la gestión o el tema del posteo.",
  neutral: "Informa o pregunta sin una carga de valor clara.",
  negativo: "Critica, se queja o expresa malestar. La ironía cuenta como negativa.",
};

const EMOTION_CRITERIA = {
  enojo: "Bronca, indignación o hartazgo.",
  miedo: "Temor o sensación de inseguridad.",
  tristeza: "Pena, resignación o abandono.",
  alegria: "Satisfacción o entusiasmo.",
  confianza: "Agradecimiento o respaldo a la gestión.",
  sorpresa: "Sorpresa o incredulidad.",
  ninguna: "No se expresa una emoción clara.",
};

type ChoiceAnswer = { choice: string; confidence: number; probabilities?: Record<string, number> };
type NoulAnswer = { noul: number; confidence: number };
type SystemOneResponse = { answers: Record<string, ChoiceAnswer & Partial<NoulAnswer>> };

async function callSystemOne(state: string, questions: Record<string, unknown>): Promise<SystemOneResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("Falta TYPESAFE_API_KEY.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: DEFAULT_TYPESAFE_MODEL, state, questions }),
    });
    if (!res.ok) throw new Error(`TypeSafe respondió ${res.status}.`);
    return (await res.json()) as SystemOneResponse;
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
export async function classifySocialBatchTypesafe(texts: string[], topics: string[]): Promise<(TypesafeRow | null)[]> {
  return mapWithConcurrency(texts, 8, async (text, index) => {
    const questions: Record<string, unknown> = {
      sentiment: {
        type: "choice",
        instructions: "Sentimiento del posteo hacia la gestión o el tema, no hacia quien escribe.",
        criteria: SENTIMENT_CRITERIA,
      },
      emotion: {
        type: "choice",
        instructions: "Emoción dominante que expresa el posteo.",
        criteria: EMOTION_CRITERIA,
      },
    };
    for (const topic of topics) {
      questions[`topic:${topic}`] = { type: "noul", instructions: `¿El posteo habla de "${topic}"?` };
    }

    try {
      const res = await callSystemOne(text.slice(0, 1500), questions);
      const sentimentAnswer = res.answers.sentiment;
      const emotionAnswer = res.answers.emotion;
      if (!sentimentAnswer?.choice) return null;

      const label = sentimentAnswer.choice as SentimentLabel;
      // Choice no da un valor continuo: se aproxima con la confianza, con signo según la etiqueta.
      const sentiment = label === "positivo" ? sentimentAnswer.confidence : label === "negativo" ? -sentimentAnswer.confidence : 0;
      const emotion = emotionAnswer?.choice && emotionAnswer.choice !== "ninguna" ? (emotionAnswer.choice as Emotion) : null;
      const matchedTopics = topics.filter((t) => (res.answers[`topic:${t}`]?.noul ?? 0) >= 0.5);

      return { index, sentiment: Math.round(sentiment * 1000) / 1000, label, emotion, topics: matchedTopics };
    } catch {
      return null;
    }
  });
}
