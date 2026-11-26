import type { Client } from "@/lib/analytics";
import type { Question, QuestionOption, QuestionWithOptions, ResponseChannel, ResponseStatus } from "@/lib/types";
import { validateInterview, type AnswerMap } from "@/lib/survey-logic";

/** Cuestionario completo, en orden, con sus opciones. */
export async function loadQuestions(supabase: Client, surveyId: string): Promise<QuestionWithOptions[]> {
  const { data: questionRows } = await supabase
    .from("questions")
    .select("*")
    .eq("survey_id", surveyId)
    .order("position");
  const questions = (questionRows ?? []) as Question[];
  if (!questions.length) return [];

  const { data: optionRows } = await supabase
    .from("question_options")
    .select("*")
    .in(
      "question_id",
      questions.map((q) => q.id),
    )
    .order("position");

  const byQuestion = new Map<string, QuestionOption[]>();
  for (const o of (optionRows ?? []) as QuestionOption[]) {
    const list = byQuestion.get(o.question_id) ?? [];
    list.push(o);
    byQuestion.set(o.question_id, list);
  }

  return questions.map((q) => ({ ...q, logic: q.logic ?? null, options: byQuestion.get(q.id) ?? [] }));
}

export type IncomingAnswer = {
  question_id: string;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  option_ids?: string[];
};

export type PersistResult =
  | { ok: true; status: Extract<ResponseStatus, "completada" | "descartada">; responseId: string }
  | {
      ok: false;
      error: string;
      /** El cuestionario rechaza esta entrevista: reintentarla igual no la arregla. */
      rejected?: boolean;
      /** Ya existe una entrevista con la misma huella: un envío repetido o simultáneo. */
      duplicate?: boolean;
    };

/** Código de Postgres para una violación de índice único. */
const UNIQUE_VIOLATION = "23505";

/**
 * El detalle técnico va al log del servidor. Al usuario (a veces alguien sin
 * sesión, en la encuesta web) no se le muestran nombres de tablas ni de
 * restricciones de la base.
 */
function failure(context: string, error: { message: string; code?: string } | null): PersistResult {
  console.error(`[persistInterview] ${context}:`, error?.code, error?.message);
  return { ok: false, error: "No se pudo guardar la entrevista. Probá de nuevo en un momento." };
}

/**
 * Valida y guarda una entrevista. Es el único camino de escritura de
 * respuestas, lo usen el campo o la web: el cliente puede mandar cualquier
 * cosa, así que acá se vuelve a recorrer el cuestionario con las mismas reglas
 * de salto, obligatoriedad, rangos y opciones que vio la persona.
 *
 * El orden importa por RLS: la respuesta nace `en_curso` (único estado en el
 * que el encuestador puede escribir sus answers) y recién al final se cierra.
 */
function finiteCoord(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function persistInterview(
  supabase: Client,
  params: {
    survey: { id: string; organization_id: string };
    questions: QuestionWithOptions[];
    answers: IncomingAnswer[];
    meta: {
      channel: ResponseChannel;
      surveyor_id: string | null;
      zone: string | null;
      duration_seconds: number;
      latitude?: number | null;
      longitude?: number | null;
      source_url?: string | null;
      respondent_hash?: string | null;
      /** Web: huella anónima de la conexión, para el límite de frecuencia. */
      ip_hash?: string | null;
      /**
       * Momento (ms) en que se tomó la entrevista. Las que salen de la cola sin
       * conexión se sincronizan horas o días después: sin esto quedarían fechadas
       * en el envío y falsearían los conteos por día y el control de calidad.
       * Quien llama ya lo acotó (no futuro, no más viejo que el tope offline).
       */
      collected_at?: number;
      /**
       * Entrevista que quedó abierta (`en_curso`) por un envío anterior que no
       * llegó a cerrar: se reutiliza en vez de abrir otra o dejarla huérfana.
       */
      resume_response_id?: string | null;
    };
  },
): Promise<PersistResult> {
  const { survey, questions, answers, meta } = params;
  if (!questions.length) return { ok: false, rejected: true, error: "La encuesta no tiene preguntas." };

  const byId = new Map(questions.map((q) => [q.id, q]));
  const values: AnswerMap = {};
  for (const a of answers) {
    if (!a || typeof a !== "object" || !byId.has(a.question_id)) continue;
    values[a.question_id] = {
      text: typeof a.value_text === "string" ? a.value_text.slice(0, 4000) : undefined,
      number: typeof a.value_number === "number" && Number.isFinite(a.value_number) ? a.value_number : undefined,
      date: typeof a.value_date === "string" ? a.value_date.slice(0, 10) : undefined,
      optionIds: Array.isArray(a.option_ids) ? [...new Set(a.option_ids.map(String))].slice(0, 50) : [],
    };
  }

  const check = validateInterview(questions, values);
  if (check.errors.length) {
    const first = check.errors[0];
    const q = byId.get(first.questionId);
    return { ok: false, rejected: true, error: `P${q?.position ?? "?"}: ${first.message}` };
  }

  const status = check.endedAt ? "descartada" : "completada";
  const onPath = check.path.filter((q) => values[q.id]);

  const durationSeconds = Math.max(0, Math.round(meta.duration_seconds));
  const collectedAt = meta.collected_at ?? Date.now();
  const startedAt = new Date(collectedAt - durationSeconds * 1000).toISOString();
  const submittedAt = new Date(collectedAt).toISOString();

  let responseId: string;
  if (meta.resume_response_id) {
    // Está abierta porque un envío anterior no llegó a cerrarla... o porque todavía la está
    // guardando. Por eso nunca se vacía: se escribe encima y recién después se quita lo que sobra.
    responseId = meta.resume_response_id;
  } else {
    const { data: response, error: responseError } = await supabase
      .from("responses")
      .insert({
        survey_id: survey.id,
        organization_id: survey.organization_id,
        surveyor_id: meta.surveyor_id,
        status: "en_curso",
        channel: meta.channel,
        zone: meta.zone?.trim().slice(0, 80) || null,
        latitude: finiteCoord(meta.latitude),
        longitude: finiteCoord(meta.longitude),
        duration_seconds: durationSeconds,
        started_at: startedAt,
        source_url: meta.source_url ?? null,
        respondent_hash: meta.respondent_hash ?? null,
        // Solo si viene: así el campo no depende de la columna `ip_hash` (migración 17).
        ...(meta.ip_hash ? { ip_hash: meta.ip_hash } : {}),
      })
      .select("id")
      .single();

    if (responseError?.code === UNIQUE_VIOLATION && meta.respondent_hash) {
      return { ok: false, duplicate: true, error: "Esta entrevista ya fue recibida." };
    }
    if (responseError || !response) return failure("abrir la entrevista", responseError);
    responseId = response.id;
  }

  if (onPath.length) {
    // Upsert: si otro envío de la misma entrevista ya escribió estas respuestas, no es un error.
    const { error: answersError } = await supabase.from("answers").upsert(
      onPath.map((q) => {
        const v = values[q.id]!;
        return {
          response_id: responseId,
          question_id: q.id,
          value_text: v.text ?? null,
          value_number: v.number ?? null,
          value_date: v.date ?? null,
          option_ids: v.optionIds ?? [],
        };
      }),
      { onConflict: "response_id,question_id" },
    );

    if (answersError) {
      // Sin respuestas la fila no sirve: si se abrió en este envío se intenta borrar para no
      // ensuciar el conteo (nunca una ya cerrada). Un encuestador no puede borrar por RLS; en
      // ese caso queda `en_curso` (no cuenta) y el reintento la reutiliza en vez de abrir otra.
      if (!meta.resume_response_id) {
        await supabase.from("responses").delete().eq("id", responseId).eq("status", "en_curso");
      }
      return failure("guardar las respuestas", answersError);
    }
  }

  if (meta.resume_response_id) {
    // Un intento anterior pudo dejar respuestas de preguntas que ya no están en el recorrido.
    const { data: stored, error: readError } = await supabase
      .from("answers")
      .select("question_id")
      .eq("response_id", responseId);
    if (readError) return failure("revisar la entrevista retomada", readError);

    const keep = new Set(onPath.map((q) => q.id));
    const stale = (stored ?? []).map((a) => a.question_id as string).filter((id) => !keep.has(id));
    if (stale.length) {
      const { error: clearError } = await supabase
        .from("answers")
        .delete()
        .eq("response_id", responseId)
        .in("question_id", stale);
      if (clearError) return failure("quitar respuestas sobrantes", clearError);
    }
  }

  const { error: closeError } = await supabase
    .from("responses")
    .update({ status, submitted_at: submittedAt })
    .eq("id", responseId);

  if (closeError) return failure("cerrar la entrevista", closeError);

  return { ok: true, status, responseId };
}
