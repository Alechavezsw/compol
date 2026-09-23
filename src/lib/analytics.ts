import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Answer,
  Database,
  Question,
  QuestionOption,
  QuestionWithOptions,
  Survey,
  SurveyAssignment,
  SurveyResponse,
} from "@/lib/types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  answerTokens,
  describeCondition,
  isAnswered,
  isExclusiveOption,
  resolvePath,
  type AnswerMap,
  type AnswerValue,
} from "@/lib/survey-logic";
import {
  SMALL_BASE,
  addDays,
  chiSquareTest,
  dayKey,
  daysBetween,
  formatDayKey,
  isNoAnswerLabel,
  marginOfError,
  maxMarginOfError,
  mean,
  median,
  numericBins,
  scaleBoxes,
  stdDev,
  twoProportionZ,
  valence,
  type ChiSquare,
} from "@/lib/stats";

export type Client = SupabaseClient<Database>;

// ===========================================================================
// Carga
// ===========================================================================

export type SurveyData = {
  survey: Survey;
  questions: QuestionWithOptions[];
  responses: SurveyResponse[];
  /** Respuestas de cada entrevista, ya en el formato que entiende survey-logic. */
  values: Map<string, AnswerMap>;
  assignments: SurveyAssignment[];
  names: Map<string, string>;
};

function toValue(a: Answer): AnswerValue {
  return {
    text: a.value_text ?? undefined,
    number: a.value_number === null || a.value_number === undefined ? undefined : Number(a.value_number),
    date: a.value_date ?? undefined,
    optionIds: a.option_ids ?? [],
  };
}

/** Trae todo lo que hace falta para analizar una encuesta, paginando. */
export async function loadSurveyData(supabase: Client, surveyId: string): Promise<SurveyData | null> {
  const { data: survey } = await supabase.from("surveys").select("*").eq("id", surveyId).maybeSingle();
  if (!survey) return null;

  const [questionRows, responses, assignmentsRes] = await Promise.all([
    supabase.from("questions").select("*").eq("survey_id", surveyId).order("position"),
    fetchAll<SurveyResponse>((from, to) =>
      supabase
        .from("responses")
        .select("*")
        .eq("survey_id", surveyId)
        .order("submitted_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    supabase.from("survey_assignments").select("*").eq("survey_id", surveyId),
  ]);

  const qs = (questionRows.data ?? []) as Question[];
  const questionIds = qs.map((q) => q.id);
  const assignments = (assignmentsRes.data ?? []) as SurveyAssignment[];

  const surveyorIds = [
    ...new Set([
      ...assignments.map((a) => a.surveyor_id),
      ...responses.map((r) => r.surveyor_id).filter((id): id is string => Boolean(id)),
    ]),
  ];

  const [options, answers, profiles] = await Promise.all([
    questionIds.length
      ? fetchAll<QuestionOption>((from, to) =>
          supabase
            .from("question_options")
            .select("*")
            .in("question_id", questionIds)
            .order("position")
            .order("id")
            .range(from, to),
        )
      : Promise.resolve([] as QuestionOption[]),
    questionIds.length
      ? fetchAll<Answer>((from, to) =>
          supabase
            .from("answers")
            .select("*")
            .in("question_id", questionIds)
            .order("id")
            .range(from, to),
        )
      : Promise.resolve([] as Answer[]),
    surveyorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", surveyorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const optionsByQuestion = new Map<string, QuestionOption[]>();
  for (const o of options) {
    const list = optionsByQuestion.get(o.question_id) ?? [];
    list.push(o);
    optionsByQuestion.set(o.question_id, list);
  }

  const values = new Map<string, AnswerMap>();
  for (const a of answers) {
    const map = values.get(a.response_id) ?? {};
    map[a.question_id] = toValue(a);
    values.set(a.response_id, map);
  }

  return {
    survey: survey as Survey,
    questions: qs.map((q) => ({
      ...q,
      logic: q.logic ?? null,
      options: (optionsByQuestion.get(q.id) ?? []).sort((a, b) => a.position - b.position),
    })),
    responses,
    values,
    assignments,
    names: new Map(((profiles.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])),
  };
}

// ===========================================================================
// Filtros
// ===========================================================================

export type AnalyticsFilters = {
  channel?: "campo" | "web" | null;
  zone?: string | null;
  surveyorId?: string | null;
  /** YYYY-MM-DD, inclusivos, en la zona horaria del operativo. */
  from?: string | null;
  to?: string | null;
  /** Solo quienes respondieron `value` (id de opción o si/no) en `questionId`. */
  segment?: { questionId: string; value: string } | null;
};

export function hasFilters(f: AnalyticsFilters) {
  return Boolean(f.channel || f.zone || f.surveyorId || f.from || f.to || f.segment);
}

const zoneOf = (r: SurveyResponse) => r.zone?.trim() || "Sin zona";

export function applyFilters(data: SurveyData, responses: SurveyResponse[], f: AnalyticsFilters) {
  const segmentQuestion = f.segment ? data.questions.find((q) => q.id === f.segment?.questionId) : null;
  return responses.filter((r) => {
    if (f.channel && (r.channel ?? "campo") !== f.channel) return false;
    if (f.zone && zoneOf(r) !== f.zone) return false;
    if (f.surveyorId && r.surveyor_id !== f.surveyorId) return false;
    const when = r.submitted_at ?? r.started_at;
    if ((f.from || f.to) && when) {
      const key = dayKey(when);
      if (f.from && key < f.from) return false;
      if (f.to && key > f.to) return false;
    }
    if (f.segment && segmentQuestion) {
      const tokens = answerTokens(segmentQuestion, data.values.get(r.id)?.[segmentQuestion.id]);
      if (!tokens.includes(f.segment.value)) return false;
    }
    return true;
  });
}

// ===========================================================================
// Resultado
// ===========================================================================

export type Distribution = {
  key: string;
  name: string;
  value: number;
  percent: number;
  /** Margen de error al 95% en puntos porcentuales. */
  moe: number | null;
  valence: 1 | -1 | 0;
  exclusive?: boolean;
};

export type QuestionAnalytics = {
  question: QuestionWithOptions;
  options: QuestionOption[];
  /** Casos a los que se les hizo la pregunta (quedó en su recorrido). */
  asked: number;
  /** Base: casos con respuesta válida. */
  answered: number;
  distribution: Distribution[];
  average: number | null;
  median: number | null;
  stdDev: number | null;
  boxes: { top: number; bottom: number; topLabel: string; bottomLabel: string } | null;
  net: { positive: number; negative: number; net: number } | null;
  noAnswerPercent: number | null;
  samples: string[];
  topTerms: { term: string; count: number }[];
  multiple: boolean;
  /** Descripción de la condición de salto, si la tiene. */
  condition: string | null;
};

export type SurveyorStats = {
  id: string;
  name: string;
  zone: string | null;
  value: number;
  discarded: number;
  quota: number | null;
  medianDuration: number | null;
  express: number;
  noAnswerShare: number | null;
  lastAt: string | null;
  daysSinceLast: number | null;
};

export type Pace = {
  perDayLast7: number;
  perDayOverall: number;
  remaining: number;
  daysToGoal: number | null;
  eta: string | null;
  endsAt: string | null;
  daysLeft: number | null;
  requiredPerDay: number | null;
  status: "cumplida" | "en_ritmo" | "atrasada" | "sin_ritmo" | "sin_fecha";
};

export type SurveyAnalytics = {
  survey: Survey;
  filters: AnalyticsFilters;
  filtered: boolean;
  totals: {
    completed: number;
    completedAll: number;
    inProgress: number;
    discarded: number;
    /** Descartadas por filtro sobre contactos efectivos (completadas + descartadas). */
    incidence: number | null;
    target: number;
    progress: number;
    avgDurationSeconds: number | null;
    medianDurationSeconds: number | null;
    lastResponseAt: string | null;
    moe: number | null;
  };
  daily: { key: string; name: string; value: number; cumulative: number }[];
  pace: Pace;
  byChannel: Distribution[];
  /** Web: sitios desde donde se respondió (host del widget). */
  bySource: Distribution[];
  byZone: Distribution[];
  bySurveyor: SurveyorStats[];
  quality: { expressThreshold: number | null; expressCount: number; expressShare: number | null };
  questions: QuestionAnalytics[];
};

const STOPWORDS = new Set(
  (
    "para que los las del con una por más mas este esta estos estas pero como hace años sobre todo todos " +
    "todas muy hay ser son sus nos les desde cuando donde porque cual cuales tiene tienen tener haya falta " +
    "mejor mejoren mejorar necesitamos queremos quiero pediría pedir llegue lleguen vuelva alguien siempre " +
    "también tambien entre hasta ellos ella ellas otro otra otros otras cada días dias barrio barrios"
  ).split(" "),
);

function topTerms(texts: string[], limit = 10) {
  const counts = new Map<string, number>();
  for (const t of texts) {
    const seen = new Set<string>();
    for (const raw of t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-zñ]+/)) {
      if (raw.length < 5 || STOPWORDS.has(raw) || seen.has(raw)) continue;
      seen.add(raw);
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function dist(key: string, name: string, value: number, base: number, extra?: Partial<Distribution>): Distribution {
  const p = base > 0 ? value / base : 0;
  return {
    key,
    name,
    value,
    percent: p * 100,
    moe: base > 0 ? marginOfError(p, base) : null,
    valence: 0,
    ...extra,
  };
}

function analyzeQuestion(
  question: QuestionWithOptions,
  data: SurveyData,
  rows: SurveyResponse[],
  askedIds: Set<string>,
): QuestionAnalytics {
  const values = rows
    .filter((r) => askedIds.has(r.id))
    .map((r) => data.values.get(r.id)?.[question.id])
    .filter((v): v is AnswerValue => isAnswered(question, v));

  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const cond = question.logic?.show_if;
  const parent = cond ? byId.get(cond.question_id) : undefined;
  const condition =
    cond && cond.values?.length
      ? `Se preguntó solo a quienes respondieron ${describeCondition(cond.values, parent)} en P${parent?.position ?? "?"}`
      : null;

  const out: QuestionAnalytics = {
    question,
    options: question.options,
    asked: askedIds.size,
    answered: values.length,
    distribution: [],
    average: null,
    median: null,
    stdDev: null,
    boxes: null,
    net: null,
    noAnswerPercent: null,
    samples: [],
    topTerms: [],
    multiple: question.type === "opcion_multiple",
    condition,
  };
  const base = values.length;

  if (question.type === "opcion_unica" || question.type === "opcion_multiple") {
    const counts = new Map<string, number>(question.options.map((o) => [o.id, 0]));
    for (const v of values) for (const id of new Set(v.optionIds)) counts.set(id, (counts.get(id) ?? 0) + 1);

    out.distribution = question.options
      .map((o) =>
        dist(o.id, o.label, counts.get(o.id) ?? 0, base, {
          valence: question.type === "opcion_unica" ? valence(o.label) : 0,
          exclusive: isExclusiveOption(o),
        }),
      )
      // Opción múltiple se lee de mayor a menor; opción única respeta el orden
      // del cuestionario si es una escala (tiene valencia), si no, por tamaño.
      .sort((a, b) =>
        question.type === "opcion_unica" && question.options.some((o) => valence(o.label) !== 0)
          ? 0
          : Number(a.exclusive) - Number(b.exclusive) || b.value - a.value,
      );

    const pos = out.distribution.filter((d) => d.valence === 1).reduce((s, d) => s + d.percent, 0);
    const neg = out.distribution.filter((d) => d.valence === -1).reduce((s, d) => s + d.percent, 0);
    if (base > 0 && pos > 0 && neg > 0) out.net = { positive: pos, negative: neg, net: pos - neg };

    const nsnc = out.distribution.filter((d) => isNoAnswerLabel(d.name)).reduce((s, d) => s + d.percent, 0);
    out.noAnswerPercent = question.options.some((o) => isNoAnswerLabel(o.label)) ? nsnc : null;
  } else if (question.type === "si_no") {
    const yes = values.filter((v) => v.text === "si").length;
    out.distribution = [dist("si", "Sí", yes, base), dist("no", "No", base - yes, base)];
  } else if (question.type === "escala" || question.type === "numero") {
    const nums = values.map((v) => v.number as number);
    out.average = mean(nums);
    out.median = median(nums);
    out.stdDev = stdDev(nums);

    if (question.type === "escala") {
      const min = Math.round(question.min_value ?? 1);
      const max = Math.round(question.max_value ?? 10);
      const counts = new Map<number, number>();
      for (const n of nums) counts.set(Math.round(n), (counts.get(Math.round(n)) ?? 0) + 1);
      out.distribution = Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) =>
        dist(String(n), String(n), counts.get(n) ?? 0, base),
      );
      const { topFrom, bottomTo } = scaleBoxes(min, max);
      if (base > 0) {
        out.boxes = {
          top: (nums.filter((n) => n >= topFrom).length / base) * 100,
          bottom: (nums.filter((n) => n <= bottomTo).length / base) * 100,
          topLabel: `${topFrom} a ${max}`,
          bottomLabel: `${min} a ${bottomTo}`,
        };
      }
    } else {
      out.distribution = numericBins(nums, question.text).map((b) =>
        dist(b.label, b.label, nums.filter(b.test).length, base),
      );
    }
  } else if (question.type === "fecha") {
    const counts = new Map<string, number>();
    for (const v of values) {
      const month = (v.date ?? "").slice(0, 7);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    out.distribution = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, c]) => dist(m, m, c, base));
  } else {
    const texts = values.map((v) => (v.text ?? "").trim()).filter(Boolean);
    out.samples = texts.slice(0, 60);
    out.topTerms = topTerms(texts);
  }

  return out;
}

/** Calcula el tablero completo sobre datos ya cargados. Función pura. */
export function computeAnalytics(data: SurveyData, filters: AnalyticsFilters = {}): SurveyAnalytics {
  const { survey } = data;
  const all = data.responses;
  const scoped = applyFilters(data, all, filters);

  const completedAll = all.filter((r) => r.status === "completada");
  const completed = scoped.filter((r) => r.status === "completada");
  const discarded = scoped.filter((r) => r.status === "descartada");
  const inProgress = scoped.filter((r) => r.status === "en_curso").length;

  const durations = completed.map((r) => r.duration_seconds ?? 0).filter((d) => d > 0);
  const medianDuration = median(durations);
  // "Exprés" es un control sobre encuestadores: se mide solo en campo y contra la
  // mediana del campo. Quien responde solo por web es naturalmente más rápido.
  const fieldDurations = completed
    .filter((r) => (r.channel ?? "campo") === "campo")
    .map((r) => r.duration_seconds ?? 0)
    .filter((d) => d > 0);
  const fieldMedian = median(fieldDurations);
  const expressThreshold = fieldMedian ? Math.round(fieldMedian * 0.4) : null;
  const isExpress = (r: SurveyResponse) =>
    (r.channel ?? "campo") === "campo" &&
    expressThreshold !== null &&
    (r.duration_seconds ?? 0) > 0 &&
    (r.duration_seconds as number) < expressThreshold;

  // --- Recorrido de cada entrevista (para bases de preguntas condicionales) --
  // Las descartadas entran solo en las preguntas filtro: ahí la base correcta
  // son todos los contactos, si no el filtro mostraría siempre 100% "pasa".
  const askedByQuestion = new Map<string, Set<string>>(data.questions.map((q) => [q.id, new Set()]));
  for (const r of [...completed, ...discarded]) {
    const { path } = resolvePath(data.questions, data.values.get(r.id) ?? {});
    for (const q of path) {
      if (r.status === "descartada" && !q.logic?.end_if?.length) continue;
      askedByQuestion.get(q.id)?.add(r.id);
    }
  }
  const contacts = [...completed, ...discarded];

  // --- Serie diaria con días vacíos incluidos ------------------------------
  const today = dayKey(Date.now());
  const perDay = new Map<string, number>();
  for (const r of completed) {
    const key = dayKey(r.submitted_at ?? r.started_at);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const keys = [...perDay.keys()].sort();
  const daily: SurveyAnalytics["daily"] = [];
  if (keys.length) {
    const last = survey.status === "activa" && today > keys[keys.length - 1] ? today : keys[keys.length - 1];
    let cumulative = 0;
    for (let k = keys[0]; k <= last; k = addDays(k, 1)) {
      const value = perDay.get(k) ?? 0;
      cumulative += value;
      daily.push({ key: k, name: formatDayKey(k), value, cumulative });
      if (daily.length > 400) break;
    }
  }

  // --- Ritmo y proyección (siempre sobre el total, no sobre el filtro) ------
  const allPerDay = new Map<string, number>();
  for (const r of completedAll) {
    const key = dayKey(r.submitted_at ?? r.started_at);
    allPerDay.set(key, (allPerDay.get(key) ?? 0) + 1);
  }
  let last7 = 0;
  for (let i = 0; i < 7; i += 1) last7 += allPerDay.get(addDays(today, -i)) ?? 0;
  const firstKey = [...allPerDay.keys()].sort()[0];
  const activeDays = firstKey ? Math.max(1, daysBetween(firstKey, today) + 1) : 0;
  const remaining = Math.max(0, survey.target_responses - completedAll.length);
  const perDayLast7 = last7 / 7;
  const endsAt = survey.ends_at ? dayKey(survey.ends_at) : null;
  const daysLeft = endsAt ? daysBetween(today, endsAt) + 1 : null;
  const daysToGoal = remaining === 0 ? 0 : perDayLast7 > 0 ? Math.ceil(remaining / perDayLast7) : null;
  const pace: Pace = {
    perDayLast7,
    perDayOverall: activeDays ? completedAll.length / activeDays : 0,
    remaining,
    daysToGoal,
    eta: daysToGoal === null ? null : addDays(today, Math.max(0, daysToGoal - 1)),
    endsAt,
    daysLeft,
    requiredPerDay: daysLeft && daysLeft > 0 ? remaining / daysLeft : null,
    status:
      remaining === 0
        ? "cumplida"
        : perDayLast7 === 0
          ? "sin_ritmo"
          : daysLeft === null
            ? "sin_fecha"
            : daysToGoal !== null && daysToGoal <= Math.max(0, daysLeft)
              ? "en_ritmo"
              : "atrasada",
  };

  // --- Canales y orígenes -----------------------------------------------------
  const channelCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  for (const r of completed) {
    const ch = r.channel ?? "campo";
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
    if (ch === "web") {
      let host = "Link directo";
      try {
        if (r.source_url) host = new URL(r.source_url).hostname.replace(/^www\./, "");
      } catch {
        /* url inválida: queda como link directo */
      }
      sourceCounts.set(host, (sourceCounts.get(host) ?? 0) + 1);
    }
  }
  const webTotal = channelCounts.get("web") ?? 0;
  const byChannel = [...channelCounts.entries()]
    .map(([k, v]) => dist(k, k === "web" ? "Web y widget" : "Campo presencial", v, completed.length))
    .sort((a, b) => b.value - a.value);
  const bySource = [...sourceCounts.entries()]
    .map(([k, v]) => dist(k, k, v, webTotal))
    .sort((a, b) => b.value - a.value);

  // --- Zonas ------------------------------------------------------------------
  const zoneCounts = new Map<string, number>();
  for (const r of completed) {
    if ((r.channel ?? "campo") === "web" && !r.zone) continue;
    zoneCounts.set(zoneOf(r), (zoneCounts.get(zoneOf(r)) ?? 0) + 1);
  }
  const zoneBase = [...zoneCounts.values()].reduce((s, v) => s + v, 0);
  const byZone = [...zoneCounts.entries()]
    .map(([name, value]) => dist(name, name, value, zoneBase))
    .sort((a, b) => b.value - a.value);

  // --- Encuestadores ----------------------------------------------------------
  const noAnswerOptionIds = new Set(
    data.questions.flatMap((q) => q.options.filter((o) => isNoAnswerLabel(o.label)).map((o) => o.id)),
  );
  const surveyorIds = new Set<string>([
    ...data.assignments.map((a) => a.surveyor_id),
    ...scoped.map((r) => r.surveyor_id).filter((id): id is string => Boolean(id)),
  ]);
  const bySurveyor: SurveyorStats[] = [...surveyorIds]
    .filter((id) => !filters.surveyorId || id === filters.surveyorId)
    .map((id) => {
      const mine = completed.filter((r) => r.surveyor_id === id);
      const assignment = data.assignments.find((a) => a.surveyor_id === id);
      const lastAt = mine.map((r) => r.submitted_at).filter(Boolean).sort().at(-1) ?? null;

      let closedAnswers = 0;
      let noAnswers = 0;
      for (const r of mine) {
        for (const v of Object.values(data.values.get(r.id) ?? {})) {
          if (!v?.optionIds?.length) continue;
          closedAnswers += 1;
          if (v.optionIds.some((o) => noAnswerOptionIds.has(o))) noAnswers += 1;
        }
      }

      return {
        id,
        name: data.names.get(id) ?? "Encuestador",
        zone: assignment?.zone ?? null,
        value: mine.length,
        discarded: discarded.filter((r) => r.surveyor_id === id).length,
        quota: assignment?.quota ?? null,
        medianDuration: median(mine.map((r) => r.duration_seconds ?? 0).filter((d) => d > 0)),
        express: mine.filter(isExpress).length,
        noAnswerShare: closedAnswers ? (noAnswers / closedAnswers) * 100 : null,
        lastAt,
        daysSinceLast: lastAt ? daysBetween(dayKey(lastAt), today) : null,
      };
    })
    .sort((a, b) => b.value - a.value);

  const expressCount = completed.filter(isExpress).length;
  const lastResponse = completed
    .map((r) => r.submitted_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    survey,
    filters,
    filtered: hasFilters(filters),
    totals: {
      completed: completed.length,
      completedAll: completedAll.length,
      inProgress,
      discarded: discarded.length,
      incidence:
        completed.length + discarded.length > 0
          ? (discarded.length / (completed.length + discarded.length)) * 100
          : null,
      target: survey.target_responses,
      progress: survey.target_responses > 0 ? (completedAll.length / survey.target_responses) * 100 : 0,
      avgDurationSeconds: durations.length ? Math.round(mean(durations) as number) : null,
      medianDurationSeconds: medianDuration ? Math.round(medianDuration) : null,
      lastResponseAt: lastResponse ?? null,
      moe: maxMarginOfError(completed.length),
    },
    daily,
    pace,
    byChannel,
    bySource,
    byZone,
    bySurveyor,
    quality: {
      expressThreshold,
      expressCount,
      expressShare: completed.length ? (expressCount / completed.length) * 100 : null,
    },
    questions: data.questions.map((q) =>
      analyzeQuestion(q, data, q.logic?.end_if?.length ? contacts : completed, askedByQuestion.get(q.id) ?? new Set()),
    ),
  };
}

/** Atajo para las pantallas que no necesitan cruces: carga y calcula. */
export async function getSurveyAnalytics(
  supabase: Client,
  surveyId: string,
  filters: AnalyticsFilters = {},
): Promise<SurveyAnalytics | null> {
  const data = await loadSurveyData(supabase, surveyId);
  return data ? computeAnalytics(data, filters) : null;
}

// ===========================================================================
// Cruces
// ===========================================================================

export type SegmentVariable = {
  id: string;
  label: string;
  kind: "zone" | "question";
  categories: { key: string; label: string }[];
};

/** Variables por las que tiene sentido abrir un resultado. */
export function segmentVariables(data: SurveyData): SegmentVariable[] {
  const completed = data.responses.filter((r) => r.status === "completada");
  const zones = [...new Set(completed.map(zoneOf))].sort((a, b) => a.localeCompare(b, "es"));
  const vars: SegmentVariable[] = [];
  if (zones.length > 1) {
    vars.push({ id: "zona", label: "Zona", kind: "zone", categories: zones.map((z) => ({ key: z, label: z })) });
  }
  for (const q of data.questions) {
    // Una pregunta filtro deja una sola categoría entre las completadas: no abre nada.
    if (q.logic?.end_if?.length) continue;
    if (q.type === "opcion_unica" && q.options.length >= 2 && q.options.length <= 8) {
      vars.push({
        id: q.id,
        label: `P${q.position}. ${q.text}`,
        kind: "question",
        categories: q.options.map((o) => ({ key: o.id, label: o.label })),
      });
    } else if (q.type === "si_no") {
      vars.push({
        id: q.id,
        label: `P${q.position}. ${q.text}`,
        kind: "question",
        categories: [
          { key: "si", label: "Sí" },
          { key: "no", label: "No" },
        ],
      });
    }
  }
  return vars;
}

const PROFILE_TEXT = /\b(edad|g[eé]nero|sexo|nivel educativo|estudios alcanzados|ocupaci[oó]n|nivel de ingresos|nse)\b/i;

/**
 * Variables de perfil: las que describen a quién responde, no lo que opina.
 * Son las que tiene sentido usar para "abrir" resultados en un hallazgo
 * automático; cruzar opinión contra opinión da asociaciones obvias.
 */
export function isProfileVariable(v: SegmentVariable, data: SurveyData) {
  if (v.kind === "zone") return true;
  const q = data.questions.find((x) => x.id === v.id);
  return Boolean(q && ((q.section ?? "").toLowerCase() === "perfil" || PROFILE_TEXT.test(q.text)));
}

/** Nombre corto de una variable de corte para usar en frases: "según edad", "por zona". */
export function variableLabel(v: SegmentVariable) {
  if (v.kind === "zone") return "zona";
  const text = v.label.replace(/^P\d+\.\s*/, "");
  if (/\bedad\b/i.test(text)) return "edad";
  if (/g[eé]nero|sexo/i.test(text)) return "género";
  if (/nivel educativo|estudios/i.test(text)) return "nivel educativo";
  if (/ocupaci/i.test(text)) return "ocupación";
  return `«${text.replace(/^¿|\?$/g, "")}»`;
}

export function isCrossable(q: QuestionWithOptions) {
  return ["opcion_unica", "opcion_multiple", "si_no", "escala"].includes(q.type);
}

export type CrosstabCell = { value: number; percent: number; z: number; sig: 1 | -1 | 0 };

export type Crosstab = {
  target: QuestionWithOptions;
  by: SegmentVariable;
  columns: { key: string; label: string; base: number; small: boolean }[];
  rows: { key: string; label: string; total: { value: number; percent: number }; cells: CrosstabCell[] }[];
  /** Solo escalas: promedio por columna. */
  means: (number | null)[] | null;
  totalBase: number;
  test: ChiSquare | null;
  multiple: boolean;
};

/** Categorías de la respuesta a la pregunta objetivo, en filas. */
function targetRows(target: QuestionWithOptions) {
  if (target.type === "si_no") {
    return [
      { key: "si", label: "Sí", has: (v: AnswerValue) => v.text === "si" },
      { key: "no", label: "No", has: (v: AnswerValue) => v.text === "no" },
    ];
  }
  if (target.type === "escala") {
    const min = Math.round(target.min_value ?? 1);
    const max = Math.round(target.max_value ?? 10);
    const { topFrom, bottomTo } = scaleBoxes(min, max);
    return [
      { key: "top", label: `Alta (${topFrom} a ${max})`, has: (v: AnswerValue) => (v.number ?? -Infinity) >= topFrom },
      {
        key: "mid",
        label: `Media (${bottomTo + 1} a ${topFrom - 1})`,
        has: (v: AnswerValue) => (v.number ?? 0) > bottomTo && (v.number ?? 0) < topFrom,
      },
      { key: "bottom", label: `Baja (${min} a ${bottomTo})`, has: (v: AnswerValue) => (v.number ?? Infinity) <= bottomTo },
    ];
  }
  return target.options.map((o) => ({
    key: o.id,
    label: o.label,
    has: (v: AnswerValue) => (v.optionIds ?? []).includes(o.id),
  }));
}

export function computeCrosstab(
  data: SurveyData,
  filters: AnalyticsFilters,
  targetId: string,
  byId: string,
): Crosstab | null {
  const target = data.questions.find((q) => q.id === targetId);
  const by = segmentVariables(data).find((v) => v.id === byId);
  if (!target || !by || !isCrossable(target) || target.id === by.id) return null;

  const byQuestion = by.kind === "question" ? data.questions.find((q) => q.id === by.id) : null;
  const completed = applyFilters(data, data.responses, filters).filter((r) => r.status === "completada");

  // Casos válidos: respondieron la pregunta objetivo y tienen categoría en la variable de corte.
  type Case = { col: number; value: AnswerValue };
  const cases: Case[] = [];
  for (const r of completed) {
    const answers = data.values.get(r.id) ?? {};
    const value = answers[target.id];
    if (!isAnswered(target, value) || !value) continue;
    let colKey: string | undefined;
    if (by.kind === "zone") colKey = zoneOf(r);
    else if (byQuestion) colKey = answerTokens(byQuestion, answers[byQuestion.id])[0];
    const col = by.categories.findIndex((c) => c.key === colKey);
    if (col >= 0) cases.push({ col, value });
  }

  const rowDefs = targetRows(target);
  const colBases = by.categories.map((_, j) => cases.filter((c) => c.col === j).length);
  const totalBase = cases.length;

  const rows = rowDefs.map((row) => {
    const counts = by.categories.map((_, j) => cases.filter((c) => c.col === j && row.has(c.value)).length);
    const rowTotal = counts.reduce((s, v) => s + v, 0);
    return {
      key: row.key,
      label: row.label,
      total: { value: rowTotal, percent: totalBase ? (rowTotal / totalBase) * 100 : 0 },
      cells: counts.map((value, j) => {
        const base = colBases[j];
        const z = twoProportionZ(value, base, rowTotal - value, totalBase - base);
        const readable = base >= SMALL_BASE && totalBase - base >= SMALL_BASE;
        return {
          value,
          percent: base ? (value / base) * 100 : 0,
          z,
          sig: (readable && Math.abs(z) >= 1.96 ? Math.sign(z) : 0) as 1 | -1 | 0,
        };
      }),
    };
  });

  const multiple = target.type === "opcion_multiple";
  return {
    target,
    by,
    columns: by.categories.map((c, j) => ({ ...c, base: colBases[j], small: colBases[j] < SMALL_BASE })),
    rows,
    means:
      target.type === "escala"
        ? by.categories.map((_, j) => mean(cases.filter((c) => c.col === j).map((c) => c.value.number as number)))
        : null,
    totalBase,
    // Chi-cuadrado solo vale con categorías excluyentes; en múltiple quedan las marcas por celda.
    test: multiple ? null : chiSquareTest(rows.map((r) => r.cells.map((c) => c.value))),
    multiple,
  };
}

export type CrosstabFinding = {
  target: QuestionWithOptions;
  by: SegmentVariable;
  pValue: number | null;
  strength: number;
  highlights: { row: string; column: string; percent: number; rest: number; base: number }[];
};

/**
 * Busca los cruces con diferencias estadísticamente significativas: es lo que
 * un analista miraría primero y lo que el informe comparativo necesita citar.
 */
export function keyFindings(data: SurveyData, filters: AnalyticsFilters = {}, limit = 8): CrosstabFinding[] {
  const all = segmentVariables(data);
  const profile = all.filter((v) => isProfileVariable(v, data));
  const vars = profile.length ? profile : all;
  const findings: CrosstabFinding[] = [];

  for (const target of data.questions) {
    if (!isCrossable(target) || target.logic?.end_if?.length) continue;
    if (profile.some((v) => v.id === target.id)) continue;

    for (const by of vars) {
      if (by.id === target.id) continue;
      const ct = computeCrosstab(data, filters, target.id, by.id);
      if (!ct || ct.totalBase < SMALL_BASE * 2) continue;

      const highlights = ct.rows
        .flatMap((row) =>
          row.cells.map((cell, j) => {
            const col = ct.columns[j];
            const restBase = ct.totalBase - col.base;
            const rest = restBase ? ((row.total.value - cell.value) / restBase) * 100 : 0;
            return { cell, row: row.label, column: col.label, percent: cell.percent, rest, base: col.base };
          }),
        )
        .filter((h) => h.cell.sig !== 0 && Math.abs(h.percent - h.rest) >= 8)
        .sort((a, b) => Math.abs(b.percent - b.rest) - Math.abs(a.percent - a.rest))
        .slice(0, 3)
        .map(({ row, column, percent, rest, base }) => ({ row, column, percent, rest, base }));

      if (!highlights.length) continue;
      if (ct.test && ct.test.pValue >= 0.05) continue;

      // Una diferencia enorme sobre 20 casos pesa menos que una clara sobre 200.
      const effect = ct.test?.cramersV ?? Math.abs(highlights[0].percent - highlights[0].rest) / 100;
      findings.push({
        target,
        by,
        pValue: ct.test?.pValue ?? null,
        strength: effect * Math.min(1, Math.sqrt(highlights[0].base / 120)) * Math.min(1, ct.totalBase / 200),
        highlights,
      });
    }
  }

  return findings.sort((a, b) => b.strength - a.strength).slice(0, limit);
}

// ===========================================================================
// Briefing para el modelo
// ===========================================================================

const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const pp = (n: number | null) => (n === null ? "s/d" : `±${n.toFixed(1).replace(".", ",")} pp`);

/**
 * Resumen compacto en texto para pasarle al modelo. Solo agregados: es lo que
 * el informe necesita y además cuida la privacidad de las personas encuestadas.
 */
export function analyticsToBriefing(a: SurveyAnalytics, findings: CrosstabFinding[] = []): string {
  const { survey, totals, pace } = a;
  const lines: string[] = [];
  lines.push(`ENCUESTA: ${survey.title}`);
  if (survey.description) lines.push(`Objetivo: ${survey.description}`);
  lines.push(`Ambito geografico: ${survey.geography ?? "no especificado"}`);
  lines.push(`Metodologia: ${survey.methodology ?? "no especificada"}`);
  lines.push(
    `Casos completados: ${totals.completed} sobre una meta de ${totals.target} (${pct(totals.progress)} de avance).`,
  );
  lines.push(
    `Margen de error maximo al 95% (MAS, p=0,5): ${pp(totals.moe)}. Las diferencias menores a ese margen no son concluyentes.`,
  );
  if (totals.discarded) {
    lines.push(
      `Entrevistas descartadas por filtro: ${totals.discarded} (${pct(totals.incidence ?? 0)} de los contactos efectivos).`,
    );
  }
  if (totals.medianDurationSeconds) {
    lines.push(`Duracion mediana de la entrevista: ${Math.round(totals.medianDurationSeconds / 60)} minutos.`);
  }
  if (a.quality.expressCount) {
    lines.push(
      `Control de calidad: ${a.quality.expressCount} entrevistas (${pct(a.quality.expressShare ?? 0)}) duraron menos del 40% de la mediana; conviene auditarlas.`,
    );
  }
  lines.push(
    `Ritmo de campo: ${pace.perDayLast7.toFixed(1)} casos/dia en los ultimos 7 dias. Estado: ${pace.status.replace("_", " ")}.`,
  );
  if (a.filtered) lines.push("ATENCION: estos resultados estan filtrados a un subconjunto de la muestra.");
  if (a.byChannel.length > 1) {
    lines.push(
      `Canales: ${a.byChannel.map((c) => `${c.name} ${c.value} (${pct(c.percent)})`).join("; ")}. Las respuestas web son autoseleccionadas: no se suman a la muestra probabilistica sin ponderar.`,
    );
  } else if (a.byChannel[0]?.key === "web") {
    lines.push("Canal: 100% web (autoadministrada, muestra no probabilistica: el margen de error es solo orientativo).");
  }
  if (a.bySource.length) {
    lines.push(`Origen de las respuestas web: ${a.bySource.slice(0, 6).map((s) => `${s.name} ${s.value}`).join("; ")}.`);
  }
  if (a.byZone.length) {
    lines.push(`Distribucion por zona: ${a.byZone.map((z) => `${z.name} ${z.value} (${pct(z.percent)})`).join("; ")}.`);
  }

  lines.push("", "RESULTADOS POR PREGUNTA");

  for (const q of a.questions) {
    lines.push("");
    lines.push(`P${q.question.position}. ${q.question.text}  [n=${q.answered}${q.answered < SMALL_BASE ? ", BASE CHICA" : ""}]`);
    if (q.condition) lines.push(`  (${q.condition}; se hizo a ${q.asked} casos)`);
    if (q.multiple) lines.push("  (Respuesta multiple: los porcentajes suman mas de 100%)");
    for (const d of q.distribution) {
      lines.push(`  - ${d.name}: ${d.value} (${pct(d.percent)}, ${pp(d.moe)})`);
    }
    if (q.net) {
      lines.push(
        `  Saldo: positivas ${pct(q.net.positive)} / negativas ${pct(q.net.negative)} / neto ${q.net.net >= 0 ? "+" : ""}${q.net.net.toFixed(1).replace(".", ",")} pp`,
      );
    }
    if (q.average !== null) {
      lines.push(
        `  Promedio: ${q.average.toFixed(2)} | Mediana: ${q.median?.toFixed(1) ?? "s/d"} | Desvio: ${q.stdDev?.toFixed(2) ?? "s/d"}`,
      );
    }
    if (q.boxes) {
      lines.push(`  Valoracion alta (${q.boxes.topLabel}): ${pct(q.boxes.top)} | baja (${q.boxes.bottomLabel}): ${pct(q.boxes.bottom)}`);
    }
    if (q.topTerms.length) {
      lines.push(`  Terminos frecuentes: ${q.topTerms.map((t) => `${t.term} (${t.count})`).join(", ")}`);
    }
    if (q.samples.length) {
      lines.push("  Respuestas textuales (muestra):");
      for (const s of q.samples.slice(0, 20)) lines.push(`  · ${s}`);
    }
  }

  if (findings.length) {
    lines.push("", "CRUCES CON DIFERENCIAS SIGNIFICATIVAS (95%, base de segmento >= 30)");
    for (const f of findings) {
      lines.push("");
      lines.push(
        `P${f.target.position} "${f.target.text}" segun ${f.by.kind === "zone" ? "zona" : `"${f.by.label}"`}${
          f.pValue !== null ? ` (chi2 p=${f.pValue < 0.001 ? "<0,001" : f.pValue.toFixed(3).replace(".", ",")})` : ""
        }:`,
      );
      for (const h of f.highlights) {
        lines.push(
          `  - "${h.row}" en ${h.column}: ${pct(h.percent)} (n=${h.base}) vs ${pct(h.rest)} en el resto (${h.percent > h.rest ? "+" : ""}${(h.percent - h.rest).toFixed(1).replace(".", ",")} pp)`,
        );
      }
    }
  } else {
    lines.push("", "CRUCES: no se detectaron diferencias significativas entre segmentos con base suficiente.");
  }

  return lines.join("\n");
}
