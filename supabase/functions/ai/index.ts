import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-pro";
const GEMINI_FALLBACK = Deno.env.get("GEMINI_FALLBACK_MODEL") || "gemini-2.5-flash";
const JEV_MODEL = Deno.env.get("TYPESAFE_MODEL") || "jev-latest";

function geminiKey() {
  const key = Deno.env.get("GEMINI_API_KEY") ?? "";
  return key.length >= 20 && !key.includes("...") ? key : "";
}

function jevKey() {
  const key = Deno.env.get("TYPESAFE_API_KEY") ?? "";
  return key.length >= 20 && !key.includes("...") ? key : "";
}

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

const KIND_BRIEF: Record<string, string> = {
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
  type: "OBJECT",
  properties: {
    titulo: { type: "STRING" },
    resumen_ejecutivo: { type: "STRING" },
    hallazgos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          titulo: { type: "STRING" },
          detalle: { type: "STRING" },
          metrica: { type: "STRING" },
        },
        required: ["titulo", "detalle", "metrica"],
      },
    },
    secciones: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          titulo: { type: "STRING" },
          contenido: { type: "STRING" },
        },
        required: ["titulo", "contenido"],
      },
    },
    recomendaciones: { type: "ARRAY", items: { type: "STRING" } },
    advertencias: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["titulo", "resumen_ejecutivo", "hallazgos", "secciones", "recomendaciones", "advertencias"],
};

const SOCIAL_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      i: { type: "INTEGER" },
      sentimiento: { type: "NUMBER" },
      etiqueta: { type: "STRING", enum: ["positivo", "neutral", "negativo"] },
      emocion: {
        type: "STRING",
        enum: ["enojo", "miedo", "tristeza", "alegria", "confianza", "sorpresa", "ninguna"],
      },
      temas: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["i", "sentimiento", "etiqueta", "emocion", "temas"],
  },
};

type Json = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isTransient(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|timeout/i.test(text);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geminiGenerate(opts: {
  model: string;
  prompt: string;
  system: string;
  temperature: number;
  schema?: Json;
}): Promise<{ text: string; model: string }> {
  const key = geminiKey();
  if (!key) throw new Error("Falta GEMINI_API_KEY en los secretos de Supabase.");

  const chain = opts.model === GEMINI_FALLBACK ? [opts.model] : [opts.model, GEMINI_FALLBACK];
  let lastError: unknown;

  for (const candidate of chain) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: opts.system }] },
            contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
            generationConfig: {
              temperature: opts.temperature,
              ...(opts.schema
                ? { responseMimeType: "application/json", responseSchema: opts.schema }
                : {}),
            },
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error?.message || `Gemini respondió ${res.status}.`);
        }
        const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("El modelo no devolvió contenido.");
        return { text, model: candidate };
      } catch (error) {
        lastError = error;
        if (!isTransient(error)) throw error;
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini no está disponible.");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
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

async function classifyWithJev(texts: string[], topics: string[]) {
  const apiKey = jevKey();
  if (!apiKey) throw new Error("Falta TYPESAFE_API_KEY en los secretos de Supabase.");

  return mapWithConcurrency(texts, 8, async (text, index) => {
    const questions: Json = {
      sentiment: {
        type: "choice",
        instructions: "Sentimiento del posteo hacia la gestión o el tema, no hacia quien escribe.",
        criteria: {
          positivo: "Valora favorablemente la gestión o el tema del posteo.",
          neutral: "Informa o pregunta sin una carga de valor clara.",
          negativo: "Critica, se queja o expresa malestar. La ironía cuenta como negativa.",
        },
      },
      emotion: {
        type: "choice",
        instructions: "Emoción dominante que expresa el posteo.",
        criteria: {
          enojo: "Bronca, indignación o hartazgo.",
          miedo: "Temor o sensación de inseguridad.",
          tristeza: "Pena, resignación o abandono.",
          alegria: "Satisfacción o entusiasmo.",
          confianza: "Agradecimiento o respaldo a la gestión.",
          sorpresa: "Sorpresa o incredulidad.",
          ninguna: "No se expresa una emoción clara.",
        },
      },
    };
    for (const topic of topics) {
      questions[`topic:${topic}`] = { type: "noul", instructions: `¿El posteo habla de "${topic}"?` };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: JEV_MODEL, state: text.slice(0, 1500), questions }),
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const payload = await res.json();
      const sentimentAnswer = payload?.answers?.sentiment;
      const emotionAnswer = payload?.answers?.emotion;
      if (!sentimentAnswer?.choice) return null;
      const label = sentimentAnswer.choice as "positivo" | "neutral" | "negativo";
      const sentiment = label === "positivo"
        ? sentimentAnswer.confidence
        : label === "negativo"
        ? -sentimentAnswer.confidence
        : 0;
      const emotion = emotionAnswer?.choice && emotionAnswer.choice !== "ninguna"
        ? emotionAnswer.choice
        : null;
      const matchedTopics = topics.filter((t) => (payload?.answers?.[`topic:${t}`]?.noul ?? 0) >= 0.5);
      return {
        index,
        sentiment: Math.round(sentiment * 1000) / 1000,
        label,
        emotion,
        topics: matchedTopics,
        provider: "jev" as const,
      };
    } catch {
      return null;
    }
  });
}

async function classifyWithGemini(texts: string[], topics: string[]) {
  const { text } = await geminiGenerate({
    model: GEMINI_FALLBACK,
    system: "Sos analista de escucha social. Devolvés solo el JSON pedido, una fila por publicación.",
    temperature: 0,
    schema: SOCIAL_SCHEMA,
    prompt: [
      "Clasificá cada publicación de redes sobre gestión pública local.",
      `Temas permitidos (usá solo estos, puede ser ninguno o varios): ${topics.join(", ")}.`,
      "Sentimiento hacia el tema o la gestión, no hacia la persona que escribe. La ironía cuenta como negativa.",
      "",
      ...texts.map((t, i) => `[${i}] ${t.replace(/\s+/g, " ").slice(0, 600)}`),
    ].join("\n"),
  });
  const parsed = JSON.parse(text) as Array<{
    i: number;
    sentimiento: number;
    etiqueta: "positivo" | "neutral" | "negativo";
    emocion: string;
    temas: string[];
  }>;
  const allowed = new Set(topics);
  return parsed.map((r) => ({
    index: r.i,
    sentiment: r.sentimiento,
    label: r.etiqueta,
    emotion: r.emocion === "ninguna" ? null : r.emocion,
    topics: (r.temas ?? []).filter((t) => allowed.has(t)),
    provider: "gemini" as const,
  }));
}

function toMarkdown(raw: Json, organizationName: string, model: string) {
  const hallazgos = (raw.hallazgos as Json[] | undefined) ?? [];
  const secciones = (raw.secciones as Json[] | undefined) ?? [];
  const recomendaciones = (raw.recomendaciones as string[] | undefined) ?? [];
  const advertencias = (raw.advertencias as string[] | undefined) ?? [];
  const parts: string[] = [];
  parts.push(`# ${raw.titulo}`);
  parts.push(
    `_${organizationName} · ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}_`,
  );
  parts.push("\n## Resumen ejecutivo\n");
  parts.push(String(raw.resumen_ejecutivo ?? ""));
  if (hallazgos.length) {
    parts.push("\n## Hallazgos principales\n");
    for (const h of hallazgos) {
      parts.push(`**${h.titulo}**${h.metrica ? ` — ${h.metrica}` : ""}\n\n${h.detalle}\n`);
    }
  }
  for (const s of secciones) {
    parts.push(`\n## ${s.titulo}\n`);
    parts.push(String(s.contenido ?? ""));
  }
  if (recomendaciones.length) {
    parts.push("\n## Recomendaciones\n");
    parts.push(recomendaciones.map((r) => `- ${r}`).join("\n"));
  }
  if (advertencias.length) {
    parts.push("\n## Advertencias metodológicas\n");
    parts.push(advertencias.map((r) => `- ${r}`).join("\n"));
  }
  return parts.join("\n");
}

async function logCall(params: {
  userId: string | null;
  organizationId: string | null;
  action: string;
  provider: string;
  model: string | null;
  status: "ok" | "error";
  error?: string;
}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  await admin.from("ai_calls").insert({
    organization_id: params.organizationId,
    action: params.action,
    provider: params.provider,
    model: params.model,
    status: params.status,
    error_message: params.error ?? null,
    created_by: params.userId,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: "No autenticado." }, 401);

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const action = String(body.action ?? "");
  const organizationId = typeof body.organization_id === "string" ? body.organization_id : null;

  try {
    if (action === "status") {
      return json({
        gemini: Boolean(geminiKey()),
        jev: Boolean(jevKey()),
        geminiModel: geminiKey() ? GEMINI_MODEL : null,
        jevModel: jevKey() ? JEV_MODEL : null,
      });
    }

    if (action === "classify") {
      const texts = Array.isArray(body.texts) ? body.texts.map((t) => String(t)) : [];
      const topics = Array.isArray(body.topics) ? body.topics.map((t) => String(t)) : [];
      if (!texts.length) return json({ error: "No hay textos para clasificar." }, 400);

      const rows: Array<Json | null> = texts.map(() => null);
      let provider: "jev" | "gemini" | "none" = "none";
      let model: string | null = null;

      if (jevKey()) {
        const jevRows = await classifyWithJev(texts, topics);
        jevRows.forEach((row, i) => {
          if (row) rows[i] = row;
        });
        if (rows.some(Boolean)) {
          provider = "jev";
          model = JEV_MODEL;
        }
      }

      const pending = rows.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
      if (pending.length && geminiKey()) {
        for (let start = 0; start < pending.length; start += 40) {
          const idxBatch = pending.slice(start, start + 40);
          const geminiRows = await classifyWithGemini(idxBatch.map((i) => texts[i]), topics);
          for (const row of geminiRows) {
            const target = idxBatch[row.index];
            if (target === undefined) continue;
            rows[target] = { ...row, index: target };
          }
        }
        if (provider === "none") {
          provider = "gemini";
          model = GEMINI_FALLBACK;
        }
      }

      await logCall({
        userId: auth.user.id,
        organizationId,
        action,
        provider,
        model,
        status: "ok",
      });
      return json({ rows, provider, model });
    }

    if (action === "report") {
      if (!geminiKey()) {
        return json({ error: "Falta GEMINI_API_KEY en los secretos de la función ai." }, 503);
      }
      const kind = String(body.kind ?? "ejecutivo");
      const organizationName = String(body.organizationName ?? "Organismo");
      const briefing = String(body.briefing ?? "");
      const audience = body.audience ? String(body.audience) : "";
      const focus = body.focus ? String(body.focus) : "";
      const socialSummary = body.socialSummary ? String(body.socialSummary) : "";
      if (briefing.length < 40) return json({ error: "El briefing de la encuesta está vacío." }, 400);

      const prompt = [
        KIND_BRIEF[kind] ?? KIND_BRIEF.ejecutivo,
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
      ].filter(Boolean).join("\n");

      const { text, model } = await geminiGenerate({
        model: GEMINI_MODEL,
        system: SYSTEM,
        temperature: 0.35,
        schema: REPORT_SCHEMA,
        prompt,
      });
      const raw = JSON.parse(text) as Json;
      const title = String(raw.titulo ?? "").slice(0, 140) || "Informe";
      const hallazgos = (raw.hallazgos as Json[] | undefined) ?? [];
      const result = {
        title,
        markdown: toMarkdown(raw, organizationName, model),
        highlights: hallazgos.map((h) => ({
          titulo: String(h.titulo ?? ""),
          detalle: String(h.detalle ?? ""),
          metrica: h.metrica ? String(h.metrica) : null,
        })),
        model,
      };
      await logCall({
        userId: auth.user.id,
        organizationId,
        action,
        provider: "gemini",
        model,
        status: "ok",
      });
      return json(result);
    }

    if (action === "ask") {
      if (!geminiKey()) {
        return json({ error: "Falta GEMINI_API_KEY en los secretos de la función ai." }, 503);
      }
      const briefing = String(body.briefing ?? "");
      const question = String(body.question ?? "").trim();
      if (question.length < 4) return json({ error: "Escribí una pregunta más completa." }, 400);
      const { text, model } = await geminiGenerate({
        model: GEMINI_FALLBACK,
        system: SYSTEM,
        temperature: 0.2,
        prompt: [
          "Datos agregados del relevamiento:",
          "-----",
          briefing,
          "-----",
          "",
          `Pregunta: ${question}`,
          "",
          "Respondé en menos de 180 palabras, en Markdown simple, citando las cifras con su base. Si el dato disponible no alcanza para responder, decilo y sugerí qué cruce mirar.",
        ].join("\n"),
      });
      await logCall({
        userId: auth.user.id,
        organizationId,
        action,
        provider: "gemini",
        model,
        status: "ok",
      });
      return json({ answer: text, model });
    }

    return json({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de la capa de IA.";
    await logCall({
      userId: auth.user.id,
      organizationId,
      action: action || "status",
      provider: geminiKey() ? "gemini" : jevKey() ? "jev" : "none",
      model: null,
      status: "error",
      error: message.slice(0, 400),
    });
    return json({ error: message }, 500);
  }
});
