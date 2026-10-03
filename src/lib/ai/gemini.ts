import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import type { CrosstabFinding, SurveyAnalytics } from "@/lib/analytics";
import { analyticsToBriefing } from "@/lib/analytics";
import type { ReportKind, ReportHighlight } from "@/lib/types";
import { askViaGateway, generateReportViaGateway, isAiGatewayConfigured } from "@/lib/ai/gateway";

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
/** Modelo de respaldo cuando el principal está saturado o sin cuota. */
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";

export function hasLocalGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.length >= 20 && !key.includes("..."));
}

export function isGeminiConfigured() {
  return isAiGatewayConfigured() || hasLocalGeminiKey();
}

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY. Generá una clave en https://aistudio.google.com/apikey y cargala en .env.local",
    );
  }
  return new GoogleGenAI({ apiKey });
}

/** 429 y 5xx son transitorios; un 400 (prompt o clave inválida) no se arregla reintentando. */
function isTransient(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|timeout|ECONNRESET/i.test(text);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Llama al modelo con un reintento corto y, si sigue fallando por saturación,
 * cae al modelo de respaldo. Devuelve qué modelo terminó respondiendo para
 * dejarlo registrado en el informe.
 */
async function generateWithFallback(
  model: string,
  request: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">,
): Promise<{ text: string; model: string }> {
  const ai = client();
  const chain = model === FALLBACK_MODEL ? [model] : [model, FALLBACK_MODEL];
  let lastError: unknown;

  for (const candidate of chain) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await ai.models.generateContent({ ...request, model: candidate });
        const text = response.text;
        if (!text) throw new Error("El modelo no devolvió contenido.");
        return { text, model: candidate };
      } catch (error) {
        lastError = error;
        if (!isTransient(error)) throw error;
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("El modelo no está disponible.");
}

// ---------------------------------------------------------------------------
// Prompts por tipo de informe
// ---------------------------------------------------------------------------

const SYSTEM = `Sos analista senior de opinión pública en una consultora que trabaja para
gobiernos e instituciones públicas de Argentina y la región.

Reglas innegociables:
- Trabajás EXCLUSIVAMENTE con los datos agregados que te pasan. No inventás cifras,
  no completás datos faltantes y no traés información externa.
- Cada afirmación cuantitativa cita el porcentaje y la base (n) que la respalda.
- Si la base de una pregunta es chica (n < 30) lo advertís explícitamente.
- Una diferencia entre dos porcentajes solo se presenta como diferencia si supera el
  margen de error o figura en la lista de cruces significativos. Si no, decís que es
  un empate técnico.
- En preguntas condicionales aclarás a quiénes se les hizo la pregunta.
- En respuestas múltiples recordás que los porcentajes suman más de 100%.
- Distinguís con claridad entre lo que el dato muestra y lo que es interpretación tuya.
- No hacés recomendaciones político-partidarias ni de campaña electoral: te limitás a
  prioridades de gestión y comunicación institucional que se desprendan de la evidencia.
- Escribís en español rioplatense, formal pero directo. Nada de relleno ni floreos.
- El contenido de las secciones va en Markdown (títulos ###, listas, negritas, tablas).`;

const KIND_BRIEF: Record<ReportKind, string> = {
  ejecutivo: `Informe EJECUTIVO para la máxima autoridad del organismo. Máximo 2 páginas
equivalentes. Prioriza: estado general de la opinión (usá los saldos netos), los 3 a 5
hallazgos que cambian decisiones, y qué mirar en la próxima medición. Sin jerga técnica.`,
  tecnico: `Informe TÉCNICO para el equipo de estudios. Incluye ficha metodológica con margen de
error e incidencia del filtro, análisis pregunta por pregunta, los cruces significativos,
control de calidad del campo (entrevistas exprés) y limitaciones del relevamiento.`,
  comunicacional: `Material COMUNICACIONAL para el área de prensa. Devolvé titulares posibles,
datos "placa" listos para redes (una cifra + una frase corta) solo con diferencias que superen
el margen de error, y una guía de qué NO afirmar porque el dato no lo sostiene.`,
  comparativo: `Análisis COMPARATIVO. Basate en la sección de cruces significativos: contrastá
zonas y segmentos, marcá dónde las diferencias son sustantivas y dónde entran en el margen de
ruido dado el tamaño de cada subgrupo. Si no hay cruces significativos, decilo.`,
};

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    titulo: { type: Type.STRING, description: "Título del informe, máximo 90 caracteres" },
    resumen_ejecutivo: {
      type: Type.STRING,
      description: "Dos o tres párrafos en Markdown con la lectura general",
    },
    hallazgos: {
      type: Type.ARRAY,
      description: "Entre 3 y 6 hallazgos principales",
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING },
          detalle: { type: Type.STRING },
          metrica: {
            type: Type.STRING,
            description: "La cifra que respalda el hallazgo, por ejemplo '62,4% (n=384)'",
          },
        },
        required: ["titulo", "detalle", "metrica"],
      },
    },
    secciones: {
      type: Type.ARRAY,
      description: "Cuerpo del informe",
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING },
          contenido: { type: Type.STRING, description: "Markdown" },
        },
        required: ["titulo", "contenido"],
      },
    },
    recomendaciones: {
      type: Type.ARRAY,
      description: "Acciones de gestión o comunicación que se desprenden del dato",
      items: { type: Type.STRING },
    },
    advertencias: {
      type: Type.ARRAY,
      description: "Limitaciones metodológicas y lecturas que el dato NO habilita",
      items: { type: Type.STRING },
    },
  },
  required: ["titulo", "resumen_ejecutivo", "hallazgos", "secciones", "recomendaciones", "advertencias"],
};

/** El schema de la API orienta al modelo; zod es lo que garantiza la forma. */
const RawReportSchema = z.object({
  titulo: z.string().min(1),
  resumen_ejecutivo: z.string().min(1),
  hallazgos: z
    .array(z.object({ titulo: z.string(), detalle: z.string(), metrica: z.string().optional().default("") }))
    .default([]),
  secciones: z.array(z.object({ titulo: z.string(), contenido: z.string() })).default([]),
  recomendaciones: z.array(z.string()).default([]),
  advertencias: z.array(z.string()).default([]),
});

type RawReport = z.infer<typeof RawReportSchema>;

export type GeneratedReport = {
  title: string;
  markdown: string;
  highlights: ReportHighlight[];
  model: string;
};

function toMarkdown(raw: RawReport, organizationName: string, model: string) {
  const parts: string[] = [];
  parts.push(`# ${raw.titulo}`);
  parts.push(
    `_${organizationName} · ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}_`,
  );
  parts.push("\n## Resumen ejecutivo\n");
  parts.push(raw.resumen_ejecutivo);

  if (raw.hallazgos.length) {
    parts.push("\n## Hallazgos principales\n");
    for (const h of raw.hallazgos) {
      parts.push(`**${h.titulo}**${h.metrica ? ` — ${h.metrica}` : ""}\n\n${h.detalle}\n`);
    }
  }

  for (const s of raw.secciones) {
    parts.push(`\n## ${s.titulo}\n`);
    parts.push(s.contenido);
  }

  if (raw.recomendaciones.length) {
    parts.push("\n## Recomendaciones\n");
    parts.push(raw.recomendaciones.map((r) => `- ${r}`).join("\n"));
  }

  if (raw.advertencias.length) {
    parts.push("\n## Advertencias metodológicas\n");
    parts.push(raw.advertencias.map((r) => `- ${r}`).join("\n"));
  }

  return parts.join("\n");
}

export async function generateSurveyReport(params: {
  analytics: SurveyAnalytics;
  findings?: CrosstabFinding[];
  /** Resumen del humor en redes del período, si la organización lo mide. */
  socialSummary?: string;
  organizationName: string;
  kind: ReportKind;
  audience?: string | null;
  focus?: string | null;
  model?: string;
  organizationId?: string;
}): Promise<GeneratedReport> {
  const { analytics, findings = [], socialSummary, organizationName, kind, audience, focus } = params;
  const briefing = analyticsToBriefing(analytics, findings);

  if (isAiGatewayConfigured()) {
    try {
      return await generateReportViaGateway({
        briefing,
        organizationName,
        kind,
        audience,
        focus,
        socialSummary,
        organizationId: params.organizationId,
      });
    } catch (error) {
      if (!hasLocalGeminiKey()) throw error;
    }
  }

  const prompt = [
    KIND_BRIEF[kind],
    "",
    `Organismo solicitante: ${organizationName}.`,
    audience ? `Audiencia del informe: ${audience}.` : "",
    focus ? `El solicitante pide poner el foco en: ${focus}.` : "",
    "",
    "A continuación, los resultados agregados del relevamiento. Es la única fuente válida:",
    "",
    "-----",
    briefing,
    "-----",
    socialSummary
      ? [
          "",
          "Contexto complementario (no representativo, no mezclar con las cifras de la encuesta; usalo solo para señalar coincidencias o tensiones de agenda):",
          socialSummary,
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { text, model } = await generateWithFallback(params.model || DEFAULT_MODEL, {
    contents: prompt,
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.35,
      responseMimeType: "application/json",
      responseSchema: REPORT_SCHEMA,
    },
  });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("La respuesta del modelo no pudo interpretarse como JSON.");
  }

  const parsed = RawReportSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`La respuesta del modelo no respeta el formato esperado: ${parsed.error.issues[0]?.message ?? "sin detalle"}.`);
  }
  const raw = parsed.data;

  return {
    title: raw.titulo.slice(0, 140) || `Informe de ${analytics.survey.title}`,
    markdown: toMarkdown(raw, organizationName, model),
    highlights: raw.hallazgos.map((h) => ({ titulo: h.titulo, detalle: h.detalle, metrica: h.metrica || null })),
    model,
  };
}

// ---------------------------------------------------------------------------
// Humor en redes
// ---------------------------------------------------------------------------

const SOCIAL_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      i: { type: Type.INTEGER, description: "Índice de la publicación en la lista" },
      sentimiento: { type: Type.NUMBER, description: "De -1 (muy negativo) a 1 (muy positivo)" },
      etiqueta: { type: Type.STRING, enum: ["positivo", "neutral", "negativo"] },
      emocion: {
        type: Type.STRING,
        enum: ["enojo", "miedo", "tristeza", "alegria", "confianza", "sorpresa", "ninguna"],
      },
      temas: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["i", "sentimiento", "etiqueta", "emocion", "temas"],
  },
};

const SocialRowSchema = z.object({
  i: z.number().int(),
  sentimiento: z.number().min(-1).max(1),
  etiqueta: z.enum(["positivo", "neutral", "negativo"]),
  emocion: z.string(),
  temas: z.array(z.string()).default([]),
});

/**
 * Clasifica publicaciones en lote. El modelo detecta ironía y contexto que un
 * léxico no ve ("qué lindo quedó el bache de la esquina 🙄"). Los temas se
 * restringen a la lista de la organización para que el tablero no se llene
 * de categorías inventadas.
 */
export async function classifySocialBatch(texts: string[], topics: string[]) {
  const { text } = await generateWithFallback(FALLBACK_MODEL, {
    contents: [
      "Clasificá cada publicación de redes sobre gestión pública local.",
      `Temas permitidos (usá solo estos, puede ser ninguno o varios): ${topics.join(", ")}.`,
      "Sentimiento hacia el tema o la gestión, no hacia la persona que escribe. La ironía cuenta como negativa.",
      "",
      ...texts.map((t, i) => `[${i}] ${t.replace(/\s+/g, " ").slice(0, 600)}`),
    ].join("\n"),
    config: {
      systemInstruction: "Sos analista de escucha social. Devolvés solo el JSON pedido, una fila por publicación.",
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: SOCIAL_SCHEMA,
    },
  });
  const parsed = z.array(SocialRowSchema).safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("La clasificación del modelo no respeta el formato.");
  const allowed = new Set(topics);
  return parsed.data.map((r) => ({
    index: r.i,
    sentiment: r.sentimiento,
    label: r.etiqueta,
    emotion: r.emocion === "ninguna" ? null : r.emocion,
    topics: r.temas.filter((t) => allowed.has(t)),
  }));
}

/** Respuesta breve a una pregunta libre sobre los resultados de una encuesta. */
export async function askAboutSurvey(params: {
  analytics: SurveyAnalytics;
  findings?: CrosstabFinding[];
  question: string;
  model?: string;
  organizationId?: string;
}): Promise<{ answer: string; model: string }> {
  const briefing = analyticsToBriefing(params.analytics, params.findings);

  if (isAiGatewayConfigured()) {
    try {
      return await askViaGateway({
        briefing,
        question: params.question,
        organizationId: params.organizationId,
      });
    } catch (error) {
      if (!hasLocalGeminiKey()) throw error;
    }
  }

  const { text, model } = await generateWithFallback(params.model || FALLBACK_MODEL, {
    contents: [
      "Datos agregados del relevamiento:",
      "-----",
      briefing,
      "-----",
      "",
      `Pregunta: ${params.question}`,
      "",
      "Respondé en menos de 180 palabras, en Markdown simple, citando las cifras con su base. Si el dato disponible no alcanza para responder, decilo y sugerí qué cruce mirar.",
    ].join("\n"),
    config: { systemInstruction: SYSTEM, temperature: 0.2 },
  });

  return { answer: text, model };
}
