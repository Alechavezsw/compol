/**
 * Qué se le manda a JEV (TypeSafe System One) y cómo se lee lo que responde.
 * Lo usan la función Edge `ai` y la app (respaldo con clave local), así que no
 * puede depender de APIs de Deno ni de Node.
 *
 * JEV no sabe nada de la organización: todo el contexto viaja en cada pedido, y
 * solo en las preguntas que lo necesitan (el texto de relleno le baja la precisión).
 * Formato: https://docs.typesafe.ai/api/system-one
 */

/** Qué entra en un tema y qué no, en palabras. */
export type TopicHint = { name: string; includes?: string; excludes?: string[] };

export type JevContext = {
  /** "Municipalidad de San Juan". */
  organization?: string;
  /** "San Juan, Argentina". */
  place?: string;
  topics?: TopicHint[];
};

const MAX_POST_CHARS = 1500;
const MAX_HINTS = 60;
const MAX_INCLUDES_CHARS = 400;
const MAX_EXCLUDES = 20;

const LANGUAGE = "Español de Argentina, informal, a veces con ironía o errores de tipeo.";

const EXPRESSIONS = [
  "«Una pinturita», «de diez», «joya»: elogio.",
  "«Se borraron», «no dan pie con bola», «chantas», «una joda»: queja.",
  "«Así estamos», «siempre lo mismo»: queja resignada.",
  "«Qué lindo» o «excelente» junto a un problema: ironía, es una queja.",
];

const EMOTIONS = {
  enojo: "Bronca, indignación o hartazgo.",
  miedo: "Temor o sensación de inseguridad.",
  tristeza: "Pena, resignación o abandono.",
  alegria: "Satisfacción o entusiasmo.",
  confianza: "Agradecimiento o respaldo a la gestión.",
  sorpresa: "Sorpresa o incredulidad.",
  ninguna: "No se expresa una emoción clara.",
};

type Label = "positivo" | "neutral" | "negativo";
type Emotion = Exclude<keyof typeof EMOTIONS, "ninguna">;

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Deja solo texto y con topes: las pistas pueden llegar en el pedido de un cliente. */
export function cleanTopicHints(raw: unknown): TopicHint[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_HINTS).flatMap((item) => {
    const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const name = clip(entry.name, 80);
    if (!name) return [];
    const includes = clip(entry.includes, MAX_INCLUDES_CHARS);
    const excludes = (Array.isArray(entry.excludes) ? entry.excludes : [])
      .map((word) => clip(word, 60))
      .filter(Boolean)
      .slice(0, MAX_EXCLUDES);
    return [{ name, ...(includes ? { includes } : {}), ...(excludes.length ? { excludes } : {}) }];
  });
}

function topicQuestion(topic: string, hint: TopicHint | undefined) {
  const instructions = `¿La publicación habla del tema «${topic}»?`;
  if (!hint?.includes && !hint?.excludes?.length) return { type: "noul", instructions };
  return {
    type: "noul",
    instructions,
    criteria: {
      true: hint.includes ? `Habla de algo de esto: ${hint.includes}.` : `Habla de ${topic}.`,
      false: hint.excludes?.length
        ? `No habla de eso. Tampoco cuenta si trata de: ${hint.excludes.join(", ")}.`
        : "No habla de eso, o usa esas palabras con otro sentido.",
    },
  };
}

/** El pedido completo para una publicación: tono, emoción y una pregunta por tema. */
export function jevRequest(model: string, text: string, topics: string[], context: JevContext = {}) {
  const organization = clip(context.organization, 200);
  const place = clip(context.place, 120);
  const hints = new Map(cleanTopicHints(context.topics).map((hint) => [hint.name, hint]));

  const questions: Record<string, unknown> = {
    sentiment: {
      type: "choice",
      instructions: {
        pregunta:
          "¿Qué postura expresa la publicación hacia la gestión o hacia el tema del que habla? No juzgues a quien la escribe.",
        ...(organization ? { gestion_evaluada: place ? `${organization} (${place})` : organization } : {}),
        idioma: LANGUAGE,
        expresiones: EXPRESSIONS,
      },
      criteria: {
        positivo: "Valora favorablemente la gestión o el tema: elogia, agradece, celebra o apoya.",
        neutral: `Informa, anuncia o pregunta sin una carga de valor clara${
          organization ? ", o habla solo de otro municipio u organismo" : ""
        }.`,
        negativo: "Critica, reclama, se queja o expresa malestar, también con ironía o sarcasmo.",
      },
    },
    emotion: {
      type: "choice",
      instructions: { pregunta: "Emoción dominante que expresa la publicación.", idioma: LANGUAGE },
      criteria: EMOTIONS,
    },
  };
  // El nombre de cada pregunta es para nosotros: el modelo no lo ve, por eso el tema va en el texto.
  for (const topic of topics) questions[`topic:${topic}`] = topicQuestion(topic, hints.get(topic));

  return { model, state: { publicacion: text.slice(0, MAX_POST_CHARS) }, questions };
}

type Answer = { choice?: string; confidence?: number; noul?: number };

/** Lee la respuesta de una publicación. `null` si no trae un tono reconocible. */
export function jevRow(index: number, payload: unknown, topics: string[]) {
  const answers = (payload as { answers?: Record<string, Answer> } | null)?.answers;
  const label = answers?.sentiment?.choice as Label | undefined;
  if (label !== "positivo" && label !== "neutral" && label !== "negativo") return null;

  // Choice no da un valor continuo: se aproxima con la confianza, con el signo de la etiqueta.
  const confidence = Number(answers?.sentiment?.confidence) || 0;
  const sentiment = label === "positivo" ? confidence : label === "negativo" ? -confidence : 0;
  const emotion = answers?.emotion?.choice;

  return {
    index,
    sentiment: Math.round(sentiment * 1000) / 1000,
    label,
    emotion: emotion && emotion !== "ninguna" && emotion in EMOTIONS ? (emotion as Emotion) : null,
    topics: topics.filter((topic) => (answers?.[`topic:${topic}`]?.noul ?? 0) >= 0.5),
  };
}
