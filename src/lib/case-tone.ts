import { numericRange, type AnswerMap } from "@/lib/survey-logic";
import { isNoAnswerLabel, valence } from "@/lib/stats";
import type { QuestionWithOptions } from "@/lib/types";

export type CaseTone = "excelente" | "bueno" | "regular" | "malo" | "malisimo" | "sin_dato";

export const CASE_TONE: Record<CaseTone, { label: string; color: string }> = {
  excelente: { label: "Muy buena", color: "#34d399" },
  bueno: { label: "Buena", color: "#22d3ee" },
  regular: { label: "Regular", color: "#fbbf24" },
  malo: { label: "Mala", color: "#fb923c" },
  malisimo: { label: "Muy mala", color: "#fb7185" },
  sin_dato: { label: "NS/NC", color: "#94a3b8" },
};

export const CASE_TONE_ORDER: CaseTone[] = ["excelente", "bueno", "regular", "malo", "malisimo", "sin_dato"];

function fold(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

export function caseToneFromLabel(label: string): CaseTone {
  const t = fold(label);
  if (isNoAnswerLabel(label) || /^(ns\s*\/?\s*nc|nsnc)$/.test(t)) return "sin_dato";
  if (/malisimo|muy mal|pesim|muy negativ|muy en desacuerdo|muy insatisfech/.test(t)) return "malisimo";
  if (/^mal|^negativ|en desacuerdo|insatisfech|desaprueb|poco probable/.test(t)) return "malo";
  if (/excelente|muy buen|muy positiv|muy de acuerdo|muy satisfech/.test(t)) return "excelente";
  if (/buen|positiv|de acuerdo|satisfech|aprueb/.test(t)) return "bueno";
  if (/regular|ni de acuerdo|ni en desacuerdo/.test(t)) return "regular";
  return "regular";
}

export function caseToneFromScale(value: number, min: number, max: number): CaseTone {
  if (!Number.isFinite(value) || max <= min) return "sin_dato";
  const t = (value - min) / (max - min);
  if (t <= 0.2) return "malisimo";
  if (t <= 0.4) return "malo";
  if (t <= 0.6) return "regular";
  if (t <= 0.8) return "bueno";
  return "excelente";
}

export function pickEvaluationQuestion(questions: QuestionWithOptions[]) {
  const skip = /perfil|filtro/i;
  return (
    questions.find(
      (q) =>
        !skip.test(q.section ?? "") &&
        q.type === "opcion_unica" &&
        q.options.some((o) => valence(o.label) !== 0),
    ) ??
    questions.find((q) => !skip.test(q.section ?? "") && q.type === "escala") ??
    null
  );
}

export function caseForAnswers(question: QuestionWithOptions | null, answers: AnswerMap | undefined) {
  if (!question || !answers) return { tone: "sin_dato" as const, label: null as string | null };
  const v = answers[question.id];
  if (!v) return { tone: "sin_dato" as const, label: null as string | null };
  if (question.type === "escala" && v.number != null) {
    const range = numericRange(question);
    const min = range.min ?? 1;
    const max = range.max ?? 10;
    return { tone: caseToneFromScale(v.number, min, max), label: String(v.number) };
  }
  const opt = question.options.find((o) => v.optionIds?.includes(o.id));
  if (!opt) return { tone: "sin_dato" as const, label: null as string | null };
  return { tone: caseToneFromLabel(opt.label), label: opt.label };
}
