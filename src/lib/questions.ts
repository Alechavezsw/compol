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
  | { ok: false; error: string };

/**
 * Valida y guarda una entrevista. Es el único camino de escritura de
 * respuestas, lo usen el campo o la web: el cliente puede mandar cualquier
 * cosa, así que acá se vuelve a recorrer el cuestionario con las mismas reglas
 * de salto, obligatoriedad, rangos y opciones que vio la persona.
 *
 * El orden importa por RLS: la respuesta nace `en_curso` (único estado en el
 * que el encuestador puede escribir sus answers) y recién al final se cierra.
 */
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
      source_url?: string | null;
      respondent_hash?: string | null;
    };
  },
): Promise<PersistResult> {
  const { survey, questions, answers, meta } = params;
  if (!questions.length) return { ok: false, error: "La encuesta no tiene preguntas." };

  const byId = new Map(questions.map((q) => [q.id, q]));
  const values: AnswerMap = {};
  for (const a of answers) {
    if (!byId.has(a.question_id)) continue;
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
    return { ok: false, error: `P${q?.position ?? "?"}: ${first.message}` };
  }

  const status = check.endedAt ? "descartada" : "completada";
  const onPath = check.path.filter((q) => values[q.id]);

  const { data: response, error: responseError } = await supabase
    .from("responses")
    .insert({
      survey_id: survey.id,
      organization_id: survey.organization_id,
      surveyor_id: meta.surveyor_id,
      status: "en_curso",
      channel: meta.channel,
      zone: meta.zone?.trim().slice(0, 80) || null,
      duration_seconds: Math.max(0, Math.round(meta.duration_seconds)),
      source_url: meta.source_url ?? null,
      respondent_hash: meta.respondent_hash ?? null,
    })
    .select("id")
    .single();

  if (responseError || !response) {
    return { ok: false, error: `No se pudo abrir la entrevista: ${responseError?.message ?? "sin detalle"}` };
  }

  if (onPath.length) {
    const { error: answersError } = await supabase.from("answers").insert(
      onPath.map((q) => {
        const v = values[q.id]!;
        return {
          response_id: response.id,
          question_id: q.id,
          value_text: v.text ?? null,
          value_number: v.number ?? null,
          value_date: v.date ?? null,
          option_ids: v.optionIds ?? [],
        };
      }),
    );

    if (answersError) {
      // Sin respuestas la fila no sirve: la descartamos para no ensuciar el conteo.
      await supabase.from("responses").delete().eq("id", response.id);
      return { ok: false, error: `No se pudieron guardar las respuestas: ${answersError.message}` };
    }
  }

  const { error: closeError } = await supabase
    .from("responses")
    .update({ status, submitted_at: new Date().toISOString() })
    .eq("id", response.id);

  if (closeError) return { ok: false, error: `No se pudo cerrar la entrevista: ${closeError.message}` };

  return { ok: true, status, responseId: response.id };
}
