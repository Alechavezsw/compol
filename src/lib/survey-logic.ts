// ---------------------------------------------------------------------------
// Reglas del cuestionario. Módulo puro: lo usan el formulario de campo (para
// guiar al encuestador) y la server action (para no confiar en el cliente).
// Si una regla cambia acá, cambia en los dos lados a la vez.
// ---------------------------------------------------------------------------

import type { QuestionOption, QuestionWithOptions } from "@/lib/types";

export type AnswerValue = {
  text?: string;
  number?: number;
  date?: string;
  optionIds?: string[];
};

export type AnswerMap = Record<string, AnswerValue | undefined>;

/** Etiquetas que por convención no se combinan con otras en opción múltiple. */
const EXCLUSIVE_PATTERN = /^(no sabe|ns\s*\/\s*nc|no contesta|ninguno|ninguna|prefiero no)/i;

export function looksExclusive(label: string) {
  return EXCLUSIVE_PATTERN.test(label.trim());
}

export function isExclusiveOption(option: Pick<QuestionOption, "label" | "is_exclusive">) {
  return option.is_exclusive || looksExclusive(option.label);
}

export function isAnswered(q: QuestionWithOptions, v: AnswerValue | undefined): boolean {
  if (!v) return false;
  switch (q.type) {
    case "opcion_unica":
    case "opcion_multiple":
      return (v.optionIds?.length ?? 0) > 0;
    case "si_no":
      return v.text === "si" || v.text === "no";
    case "escala":
    case "numero":
      return typeof v.number === "number" && Number.isFinite(v.number);
    case "fecha":
      return Boolean(v.date);
    default:
      return Boolean(v.text?.trim());
  }
}

/** Valores "comparables" de una respuesta: ids de opción o si/no. */
export function answerTokens(q: Pick<QuestionWithOptions, "type">, v: AnswerValue | undefined) {
  if (!v) return [];
  if (q.type === "si_no") return v.text ? [v.text] : [];
  return v.optionIds ?? [];
}

/**
 * Una pregunta se muestra si no tiene condición, o si la pregunta de la que
 * depende está visible y su respuesta coincide. Evaluar la visibilidad de la
 * dependencia evita que un salto "herede" una respuesta que quedó huérfana
 * cuando el encuestador volvió atrás y cambió de rama.
 */
export function isVisible(
  q: QuestionWithOptions,
  answers: AnswerMap,
  byId: Map<string, QuestionWithOptions>,
  depth = 0,
): boolean {
  const cond = q.logic?.show_if;
  if (!cond?.question_id || !cond.values?.length) return true;
  const parent = byId.get(cond.question_id);
  if (!parent || depth > 20) return true;
  if (!isVisible(parent, answers, byId, depth + 1)) return false;
  const tokens = answerTokens(parent, answers[parent.id]);
  return tokens.some((t) => cond.values.includes(t));
}

/** ¿Esta respuesta cierra la entrevista por filtro? */
export function triggersEnd(q: QuestionWithOptions, v: AnswerValue | undefined) {
  const endIf = q.logic?.end_if;
  if (!endIf?.length) return false;
  return answerTokens(q, v).some((t) => endIf.includes(t));
}

/**
 * Recorre el cuestionario en orden y devuelve lo que efectivamente se le
 * pregunta a esta persona. Si una respuesta dispara un filtro, el recorrido se
 * corta ahí y `endedAt` indica en qué pregunta.
 */
export function resolvePath(questions: QuestionWithOptions[], answers: AnswerMap) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const path: QuestionWithOptions[] = [];
  let endedAt: QuestionWithOptions | null = null;

  for (const q of questions) {
    if (!isVisible(q, answers, byId)) continue;
    path.push(q);
    if (triggersEnd(q, answers[q.id])) {
      endedAt = q;
      break;
    }
  }

  return { path, endedAt };
}

/** Tope de marcas para opción múltiple (null = sin tope). */
export function maxChoices(q: QuestionWithOptions) {
  if (q.type !== "opcion_multiple" || !q.max_value) return null;
  const n = Math.floor(Number(q.max_value));
  return n >= 1 ? n : null;
}

export function numericRange(q: QuestionWithOptions) {
  if (q.type === "escala") {
    return { min: Math.round(q.min_value ?? 1), max: Math.round(q.max_value ?? 10) };
  }
  if (q.type === "numero") {
    return {
      min: q.min_value === null ? null : Number(q.min_value),
      max: q.max_value === null ? null : Number(q.max_value),
    };
  }
  return { min: null, max: null };
}

/**
 * Valida una respuesta individual. Devuelve el mensaje para el encuestador o
 * null si está bien. No mira obligatoriedad: eso depende de si la pregunta
 * quedó en el recorrido, y lo resuelve `validateInterview`.
 */
export function validateAnswer(q: QuestionWithOptions, v: AnswerValue | undefined): string | null {
  if (!isAnswered(q, v) || !v) return null;

  switch (q.type) {
    case "opcion_unica": {
      const ids = v.optionIds ?? [];
      if (ids.length !== 1) return "Elegí una sola opción.";
      if (!q.options.some((o) => o.id === ids[0])) return "La opción elegida no pertenece a la pregunta.";
      return null;
    }
    case "opcion_multiple": {
      const ids = [...new Set(v.optionIds ?? [])];
      const valid = new Map(q.options.map((o) => [o.id, o]));
      if (ids.some((id) => !valid.has(id))) return "Hay opciones que no pertenecen a la pregunta.";
      const limit = maxChoices(q);
      if (limit && ids.length > limit) {
        return `Se pueden marcar hasta ${limit} opciones.`;
      }
      const exclusive = ids.filter((id) => isExclusiveOption(valid.get(id)!));
      if (exclusive.length && ids.length > 1) {
        return `«${valid.get(exclusive[0])!.label}» no se combina con otras opciones.`;
      }
      return null;
    }
    case "si_no":
      return v.text === "si" || v.text === "no" ? null : "Respuesta inválida.";
    case "escala":
    case "numero": {
      const n = v.number as number;
      const { min, max } = numericRange(q);
      if (q.type === "escala" && !Number.isInteger(n)) return "La escala solo admite valores enteros.";
      if (min !== null && n < min) return `El valor mínimo es ${min}.`;
      if (max !== null && n > max) return `El valor máximo es ${max}.`;
      return null;
    }
    case "fecha":
      return Number.isNaN(new Date(`${v.date}T12:00:00`).getTime()) ? "Fecha inválida." : null;
    default:
      return (v.text?.length ?? 0) > 4000 ? "La respuesta es demasiado larga." : null;
  }
}

export type InterviewCheck = {
  path: QuestionWithOptions[];
  endedAt: QuestionWithOptions | null;
  errors: { questionId: string; message: string }[];
};

/** Valida la entrevista completa como la vería el servidor. */
export function validateInterview(questions: QuestionWithOptions[], answers: AnswerMap): InterviewCheck {
  const { path, endedAt } = resolvePath(questions, answers);
  const errors: InterviewCheck["errors"] = [];

  for (const q of path) {
    const v = answers[q.id];
    if (q.is_required && !isAnswered(q, v)) {
      errors.push({ questionId: q.id, message: "Esta pregunta es obligatoria." });
      continue;
    }
    const message = validateAnswer(q, v);
    if (message) errors.push({ questionId: q.id, message });
  }

  return { path, endedAt, errors };
}

/** Texto corto de una respuesta, para la pantalla de revisión y los CSV. */
export function describeAnswer(q: QuestionWithOptions, v: AnswerValue | undefined): string {
  if (!isAnswered(q, v) || !v) return "";
  switch (q.type) {
    case "opcion_unica":
    case "opcion_multiple": {
      const labels = new Map(q.options.map((o) => [o.id, o.label]));
      return (v.optionIds ?? []).map((id) => labels.get(id) ?? "?").join(" · ");
    }
    case "si_no":
      return v.text === "si" ? "Sí" : "No";
    case "escala":
    case "numero":
      return String(v.number);
    case "fecha":
      return v.date ?? "";
    default:
      return v.text?.trim() ?? "";
  }
}

/** Describe una condición en lenguaje natural para el editor. */
export function describeCondition(
  values: string[],
  source: QuestionWithOptions | undefined,
): string {
  if (!source) return "una pregunta que ya no existe";
  if (source.type === "si_no") {
    return values.map((v) => (v === "si" ? "Sí" : "No")).join(" o ");
  }
  const labels = new Map(source.options.map((o) => [o.id, o.label]));
  return values.map((v) => labels.get(v) ?? "opción eliminada").join(", ");
}

/** Las preguntas que pueden servir de condición: de opción o sí/no. */
export function isBranchable(q: Pick<QuestionWithOptions, "type">) {
  return q.type === "opcion_unica" || q.type === "opcion_multiple" || q.type === "si_no";
}
