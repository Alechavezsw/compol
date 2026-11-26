/**
 * Datos y cuentas del tablero territorial (lo que ve el político). Es código puro
 * y sin dependencias de servidor: el navegador recalcula todo al tocar una zona,
 * un perfil o la línea de tiempo, sin volver a pedir nada.
 */

export type EvalTone = "muy_neg" | "neg" | "neutro" | "pos" | "muy_pos" | "sin_dato";

/** Orden de lectura de una barra de evaluación: de lo peor a lo mejor. */
export const TONE_ORDER: EvalTone[] = ["muy_neg", "neg", "neutro", "pos", "muy_pos", "sin_dato"];

export type PulseOption = { label: string; valence: 1 | -1 | 0; tone: EvalTone };

export type PulseQuestion = {
  id: string;
  text: string;
  /** Nombre corto para títulos y filtros: "Edad", "Género". */
  label: string;
  kind: "opcion" | "multiple" | "escala";
  options: PulseOption[];
  min: number;
  max: number;
};

export type PulseCase = {
  /** Índice en `zones`; -1 si el caso no tiene zona. */
  z: number;
  /** Posición en `days` del día en que se cargó. */
  d: number;
  /** Latitud y longitud, si se tomaron. */
  p: [number, number] | null;
  /** Una celda por pregunta: índice de opción, lista de índices o valor de escala. */
  v: (number | number[] | null)[];
};

export type PulseData = {
  zones: string[];
  /** Días corridos YYYY-MM-DD, del primer caso al último. */
  days: string[];
  questions: PulseQuestion[];
  /** Posición en `questions` de cada papel que cumple una pregunta en el tablero. */
  roles: {
    evaluation: number | null;
    agenda: number | null;
    scale: number | null;
    profile: number[];
    others: number[];
  };
  cases: PulseCase[];
};

export type PulseFilter = {
  zone: number | null;
  /** Pregunta de perfil → opción elegida. */
  segments: Record<number, number>;
  /** Último día incluido (posición en `days`); `null` es todo. */
  day: number | null;
};

export function filterCases(cases: PulseCase[], filter: PulseFilter) {
  const segments = Object.entries(filter.segments);
  return cases.filter((c) => {
    if (filter.zone !== null && c.z !== filter.zone) return false;
    if (filter.day !== null && c.d > filter.day) return false;
    return segments.every(([question, option]) => c.v[Number(question)] === option);
  });
}

export type Balance = {
  /** Porcentajes sobre quienes respondieron, incluidos los NS/NC (igual que en Resultados). */
  positive: number;
  negative: number;
  net: number;
  base: number;
};

export function balance(cases: PulseCase[], index: number, question: PulseQuestion): Balance | null {
  let positive = 0;
  let negative = 0;
  let base = 0;
  for (const c of cases) {
    const value = c.v[index];
    if (typeof value !== "number") continue;
    base += 1;
    const valence = question.options[value]?.valence ?? 0;
    if (valence === 1) positive += 1;
    if (valence === -1) negative += 1;
  }
  if (!base) return null;
  return {
    positive: (positive / base) * 100,
    negative: (negative / base) * 100,
    net: ((positive - negative) / base) * 100,
    base,
  };
}

export type Share = { index: number; label: string; tone: EvalTone; count: number; percent: number };

/** Reparto por opción. En opción múltiple la base son las personas, así que puede sumar más de 100. */
export function distribution(cases: PulseCase[], index: number, question: PulseQuestion) {
  const counts = question.options.map(() => 0);
  let base = 0;
  for (const c of cases) {
    const value = c.v[index];
    if (value === null || value === undefined) continue;
    const picked = Array.isArray(value) ? value : [value];
    if (!picked.length) continue;
    base += 1;
    for (const option of picked) if (counts[option] !== undefined) counts[option] += 1;
  }
  const shares: Share[] = question.options.map((option, i) => ({
    index: i,
    label: option.label,
    tone: option.tone,
    count: counts[i],
    percent: base ? (counts[i] / base) * 100 : 0,
  }));
  return { shares, base };
}

export function average(cases: PulseCase[], index: number) {
  let sum = 0;
  let base = 0;
  for (const c of cases) {
    const value = c.v[index];
    if (typeof value !== "number") continue;
    sum += value;
    base += 1;
  }
  return base ? { value: sum / base, base } : null;
}

/** Centro de cada zona según dónde se tomaron sus casos. Se calcula con todos, así no se mueve al filtrar. */
export function zoneCenters(data: PulseData) {
  return data.zones.map((_, zone) => {
    let lat = 0;
    let lng = 0;
    let n = 0;
    for (const c of data.cases) {
      if (c.z !== zone || !c.p) continue;
      lat += c.p[0];
      lng += c.p[1];
      n += 1;
    }
    return n ? ([lat / n, lng / n] as [number, number]) : null;
  });
}

export type ZoneSummary = {
  index: number;
  name: string;
  count: number;
  balance: Balance | null;
  average: number | null;
};

export function zoneSummaries(data: PulseData, cases: PulseCase[]): ZoneSummary[] {
  const { evaluation, scale } = data.roles;
  const grouped = data.zones.map(() => [] as PulseCase[]);
  for (const c of cases) grouped[c.z]?.push(c);
  return data.zones.map((name, index) => ({
    index,
    name,
    count: grouped[index].length,
    balance: evaluation === null ? null : balance(grouped[index], evaluation, data.questions[evaluation]),
    average: scale === null ? null : (average(grouped[index], scale)?.value ?? null),
  }));
}

export type DayPoint = {
  day: number;
  key: string;
  count: number;
  /** Saldo de los últimos `window` días hasta este: suaviza los días con pocos casos. */
  net: number | null;
  /** Respuestas que sostienen ese saldo. */
  base: number;
};

export function dailySeries(data: PulseData, cases: PulseCase[], upTo: number, window = 7): DayPoint[] {
  const perDay = data.days.map(() => [] as PulseCase[]);
  for (const c of cases) perDay[c.d]?.push(c);
  const { evaluation } = data.roles;
  return data.days.slice(0, upTo + 1).map((key, day) => {
    const recent = perDay.slice(Math.max(0, day - window + 1), day + 1).flat();
    const rolled = evaluation === null ? null : balance(recent, evaluation, data.questions[evaluation]);
    return { day, key, count: perDay[day].length, net: rolled ? rolled.net : null, base: rolled?.base ?? 0 };
  });
}

/** Cuánto cambió el saldo: últimos 7 días contra los 7 anteriores. Sin `minBase` en cada semana no se informa. */
export function weeklyChange(data: PulseData, cases: PulseCase[], upTo: number, minBase = 1) {
  const { evaluation } = data.roles;
  if (evaluation === null) return null;
  const question = data.questions[evaluation];
  const current = balance(cases.filter((c) => c.d > upTo - 7 && c.d <= upTo), evaluation, question);
  const previous = balance(cases.filter((c) => c.d > upTo - 14 && c.d <= upTo - 7), evaluation, question);
  if (!current || !previous || current.base < minBase || previous.base < minBase) return null;
  return current.net - previous.net;
}

/** Con signo y sin decimales: "+12", "−8", "0". */
export function signed(value: number) {
  const rounded = Math.round(value);
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}
