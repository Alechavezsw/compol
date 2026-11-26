import { isProfileVariable, segmentVariables, variableLabel, type SurveyData } from "@/lib/analytics";
import { caseToneFromLabel, pickEvaluationQuestion, type CaseTone } from "@/lib/case-tone";
import type { EvalTone, PulseCase, PulseData, PulseQuestion } from "@/lib/pulse";
import { addDays, dayKey, todayKey, valence } from "@/lib/stats";
import type { QuestionWithOptions } from "@/lib/types";

const TONE: Record<CaseTone, EvalTone> = {
  excelente: "muy_pos",
  bueno: "pos",
  regular: "neutro",
  malo: "neg",
  malisimo: "muy_neg",
  sin_dato: "sin_dato",
};

const MAX_DAYS = 400;
const ZONE_TEXT = /\b(zona|barrio|departamento|distrito|localidad)\b/i;

function shortLabel(question: QuestionWithOptions, fallback?: string) {
  const section = question.section?.trim();
  const name =
    fallback && !fallback.startsWith("«")
      ? fallback
      : section && section.toLowerCase() !== "perfil"
        ? section
        : question.text.replace(/^¿|\?$/g, "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Tono de una respuesta de evaluación según su texto: "Muy buena", "Mala", "Regular"… */
export function evalToneOf(label: string): EvalTone {
  return TONE[caseToneFromLabel(label)];
}

function toPulseQuestion(question: QuestionWithOptions, label: string): PulseQuestion {
  return {
    id: question.id,
    text: question.text,
    label,
    kind: question.type === "escala" ? "escala" : question.type === "opcion_multiple" ? "multiple" : "opcion",
    options: question.options.map((o) => ({ label: o.label, valence: valence(o.label), tone: evalToneOf(o.label) })),
    min: Math.round(question.min_value ?? 1),
    max: Math.round(question.max_value ?? 10),
  };
}

/**
 * Reduce una encuesta a lo que necesita el tablero: sin nombres, sin ids de
 * personas ni de encuestadores, solo zona, día, punto y respuestas elegidas.
 */
export function buildPulse(
  data: SurveyData,
  today = todayKey(),
  /** Si viene, solo estas entrevistas entran como casos; zonas y días se siguen calculando con todas. */
  keep?: Set<string>,
): PulseData | null {
  const completed = data.responses.filter((r) => r.status === "completada");
  if (!completed.length) return null;

  const eligible = data.questions.filter((q) => !q.logic?.end_if?.length);
  // La encuesta web no registra zona: si el cuestionario la pregunta, se usa esa respuesta.
  const zoneQuestion = completed.every((r) => !r.zone?.trim())
    ? (eligible.find((q) => q.type === "opcion_unica" && ZONE_TEXT.test(q.text)) ?? null)
    : null;
  const usable = eligible.filter((q) => q.id !== zoneQuestion?.id);
  const zoneOf = (r: (typeof completed)[number]) => {
    if (!zoneQuestion) return r.zone?.trim() ?? "";
    const picked = data.values.get(r.id)?.[zoneQuestion.id]?.optionIds?.[0];
    return zoneQuestion.options.find((o) => o.id === picked)?.label ?? "";
  };
  const inProfile = new Map(
    segmentVariables(data)
      .filter((v) => v.kind === "question" && isProfileVariable(v, data))
      .map((v) => [v.id, variableLabel(v)]),
  );
  const isProfile = (q: QuestionWithOptions) => inProfile.has(q.id) || (q.section ?? "").toLowerCase() === "perfil";

  const candidate = pickEvaluationQuestion(usable);
  // Solo sirve de evaluación una opción única con respuestas a favor y en contra.
  const evaluation =
    candidate?.type === "opcion_unica" &&
    candidate.options.some((o) => valence(o.label) === 1) &&
    candidate.options.some((o) => valence(o.label) === -1)
      ? candidate
      : null;
  const agenda = usable.find((q) => q.type === "opcion_multiple" && !isProfile(q)) ?? null;
  const scale = usable.find((q) => q.type === "escala" && !isProfile(q)) ?? null;
  const profile = usable.filter((q) => q.type === "opcion_unica" && inProfile.has(q.id)).slice(0, 2);
  const others = usable
    .filter((q) => q.type === "opcion_unica" && !isProfile(q) && q.id !== evaluation?.id)
    .slice(0, 2);

  const picked: { question: QuestionWithOptions; label: string }[] = [];
  const add = (question: QuestionWithOptions | null, label?: string) => {
    if (!question) return null;
    picked.push({ question, label: shortLabel(question, label) });
    return picked.length - 1;
  };
  const roles: PulseData["roles"] = {
    evaluation: add(evaluation),
    agenda: add(agenda),
    scale: add(scale),
    profile: profile.map((q) => add(q, inProfile.get(q.id)) as number),
    others: others.map((q) => add(q, q.text) as number),
  };
  const questions = picked.map((p) => toPulseQuestion(p.question, p.label));

  const zones = [...new Set(completed.map(zoneOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

  const keys = completed.map((r) => dayKey(r.submitted_at ?? r.started_at)).sort();
  const lastCase = keys[keys.length - 1];
  const end = data.survey.status === "activa" && today > lastCase ? today : lastCase;
  // Si el operativo es larguísimo, se muestran los últimos días y lo anterior queda en el primero.
  const earliest = addDays(end, -(MAX_DAYS - 1));
  const start = keys[0] > earliest ? keys[0] : earliest;
  const days: string[] = [];
  for (let key = start; key <= end; key = addDays(key, 1)) days.push(key);
  const dayIndex = new Map(days.map((key, i) => [key, i]));

  const cases: PulseCase[] = completed.filter((r) => !keep || keep.has(r.id)).map((r) => {
    const values = data.values.get(r.id) ?? {};
    return {
      z: zones.indexOf(zoneOf(r)),
      d: dayIndex.get(dayKey(r.submitted_at ?? r.started_at)) ?? 0,
      p:
        r.latitude !== null && r.longitude !== null
          ? [Number(r.latitude.toFixed(4)), Number(r.longitude.toFixed(4))]
          : null,
      v: picked.map(({ question }) => {
        const answer = values[question.id];
        if (!answer) return null;
        if (question.type === "escala") return answer.number ?? null;
        const indexes = (answer.optionIds ?? [])
          .map((id) => question.options.findIndex((o) => o.id === id))
          .filter((i) => i >= 0);
        if (question.type === "opcion_multiple") return indexes.length ? indexes : null;
        return indexes[0] ?? null;
      }),
    };
  });

  return { zones, days, questions, roles, cases };
}
