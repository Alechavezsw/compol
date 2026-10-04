// ---------------------------------------------------------------------------
// Estadística para el tablero. Todo con muestreo aleatorio simple como
// supuesto: es la convención de la industria para reportar el margen de error,
// aunque el campo sea por cuotas. El informe lo aclara como advertencia.
// ---------------------------------------------------------------------------

export const Z95 = 1.96;

/** Base mínima para leer un porcentaje con algo de firmeza. */
export const SMALL_BASE = 30;

/** Zona horaria de referencia para agrupar por día. */
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "America/Argentina/Buenos_Aires";

/** Margen de error en puntos porcentuales para una proporción `p` (0..1) con base `n`. */
export function marginOfError(p: number, n: number, z = Z95) {
  if (n <= 0) return null;
  const safeP = Math.min(1, Math.max(0, p));
  return z * Math.sqrt((safeP * (1 - safeP)) / n) * 100;
}

/** Margen de error máximo (p = 0,5), el que se publica en la ficha técnica. */
export function maxMarginOfError(n: number, z = Z95) {
  return marginOfError(0.5, n, z);
}

/**
 * Test de diferencia de proporciones entre un segmento y el resto de la
 * muestra. Devuelve el estadístico z: |z| > 1,96 es significativo al 95%.
 */
export function twoProportionZ(x1: number, n1: number, x2: number, n2: number) {
  if (n1 <= 0 || n2 <= 0) return 0;
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  return se === 0 ? 0 : (p1 - p2) / se;
}

// --- Chi-cuadrado -----------------------------------------------------------

/** log Γ(x) por Lanczos. */
function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const coef of c) ser += coef / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Gamma incompleta regularizada superior Q(a, x). */
function gammaQ(a: number, x: number): number {
  if (x < 0 || a <= 0) return 1;
  if (x === 0) return 1;

  if (x < a + 1) {
    // Serie para P, devolvemos 1 - P.
    let sum = 1 / a;
    let del = sum;
    let ap = a;
    for (let i = 0; i < 200; i += 1) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }

  // Fracción continua para Q (Lentz).
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 200; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

export type ChiSquare = { chi2: number; df: number; pValue: number; cramersV: number };

/**
 * Chi-cuadrado de independencia sobre una tabla de conteos (filas × columnas).
 * Filas o columnas vacías se ignoran para no inflar los grados de libertad.
 */
export function chiSquareTest(table: number[][]): ChiSquare | null {
  const rows = table.filter((r) => r.some((v) => v > 0));
  if (rows.length < 2) return null;
  const colCount = rows[0].length;
  const colTotals = Array.from({ length: colCount }, (_, j) => rows.reduce((s, r) => s + r[j], 0));
  const keepCols = colTotals.map((t, j) => (t > 0 ? j : -1)).filter((j) => j >= 0);
  if (keepCols.length < 2) return null;

  const m = rows.map((r) => keepCols.map((j) => r[j]));
  const rowTotals = m.map((r) => r.reduce((s, v) => s + v, 0));
  const cols = keepCols.map((_, j) => m.reduce((s, r) => s + r[j], 0));
  const total = rowTotals.reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  let chi2 = 0;
  for (let i = 0; i < m.length; i += 1) {
    for (let j = 0; j < cols.length; j += 1) {
      const expected = (rowTotals[i] * cols[j]) / total;
      if (expected > 0) chi2 += (m[i][j] - expected) ** 2 / expected;
    }
  }

  const df = (m.length - 1) * (cols.length - 1);
  const pValue = gammaQ(df / 2, chi2 / 2);
  const cramersV = Math.sqrt(chi2 / (total * Math.max(1, Math.min(m.length, cols.length) - 1)));
  return { chi2, df, pValue, cramersV };
}

// --- Descriptivos -----------------------------------------------------------

export function mean(values: number[]) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stdDev(values: number[]) {
  if (values.length < 2) return null;
  const m = mean(values) as number;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

/** Paso "redondo" (1, 2, 5, 10, 20, 25, 50...) para armar tramos legibles. */
function niceStep(raw: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export type Bin = { label: string; test: (v: number) => boolean };

const AGE_BINS: Bin[] = [
  { label: "Hasta 29", test: (v) => v < 30 },
  { label: "30 a 44", test: (v) => v >= 30 && v < 45 },
  { label: "45 a 59", test: (v) => v >= 45 && v < 60 },
  { label: "60 o más", test: (v) => v >= 60 },
];

/**
 * Tramos para preguntas numéricas libres. Si el enunciado habla de edad usa
 * los cortes etarios habituales en opinión pública; si no, arma entre 4 y 6
 * tramos de ancho redondo sobre el rango real de los datos.
 */
export function numericBins(values: number[], questionText = ""): Bin[] {
  if (/\bedad\b|\baños\b/i.test(questionText)) return AGE_BINS;
  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ label: String(min), test: (v) => v === min }];

  const allInts = values.every(Number.isInteger);
  const distinct = new Set(values).size;
  if (allInts && distinct <= 6) {
    return [...new Set(values)]
      .sort((a, b) => a - b)
      .map((n) => ({ label: String(n), test: (v: number) => v === n }));
  }

  const step = niceStep((max - min) / 5);
  const start = Math.floor(min / step) * step;
  const bins: Bin[] = [];
  const fmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
  for (let lo = start; lo <= max; lo += step) {
    const hi = lo + step;
    const last = hi > max;
    bins.push({
      label: allInts ? `${fmt.format(lo)} a ${fmt.format(hi - 1)}` : `${fmt.format(lo)} a ${fmt.format(hi)}`,
      test: last ? (v) => v >= lo : (v) => v >= lo && v < hi,
    });
  }
  return bins;
}

/**
 * Cortes de "caja" para escalas: top box = cuarto superior del rango (8-10 en
 * una escala 1-10, 4-5 en una 1-5), bottom box = 40% inferior (1-4, 1-2).
 */
export function scaleBoxes(min: number, max: number) {
  const range = max - min;
  return {
    topFrom: Math.ceil(max - range * 0.25),
    bottomTo: Math.floor(min + range * 0.4),
  };
}

// --- Fechas ---------------------------------------------------------------

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día calendario (YYYY-MM-DD) en la zona horaria del operativo, no en UTC. */
export function dayKey(value: string | number | Date) {
  return dayKeyFmt.format(new Date(value));
}

/** Hoy en la zona horaria del operativo. */
export function todayKey() {
  return dayKey(Date.now());
}

/**
 * Inicio y fin (ISO UTC) del día calendario `key` en la zona del operativo.
 * Argentina no tiene DST: el offset fijo -03 coincide con TIME_ZONE por defecto.
 */
export function dayBoundsIso(key: string) {
  const start = new Date(`${key}T00:00:00-03:00`);
  const end = new Date(`${addDays(key, 1)}T00:00:00-03:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function addDays(key: string, n: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string) {
  return Math.round(
    (new Date(`${toKey}T12:00:00Z`).getTime() - new Date(`${fromKey}T12:00:00Z`).getTime()) /
      86_400_000,
  );
}

const shortDayFmt = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" });

export function formatDayKey(key: string) {
  return shortDayFmt.format(new Date(`${key}T12:00:00Z`)).replace(".", "");
}

// --- Valencia de opciones -------------------------------------------------

const POSITIVE = /^(muy bueno|muy buena|bueno|buena|excelente|positiv|muy de acuerdo|de acuerdo|muy satisfech|satisfech|mejor|aprueb|muy probable|probable|s[ií]$)/i;
const NEGATIVE = /^(muy malo|muy mala|mal[ií]simo|malo|mala|p[eé]sim|negativ|muy en desacuerdo|en desacuerdo|muy insatisfech|insatisfech|peor|desaprueb|nada probable|poco probable|no$)/i;

/**
 * Detecta si una opción es positiva o negativa para calcular un saldo neto
 * (positivas − negativas), la forma estándar de resumir una evaluación.
 */
export function valence(label: string): 1 | -1 | 0 {
  const clean = label.trim();
  if (NEGATIVE.test(clean)) return -1;
  if (POSITIVE.test(clean)) return 1;
  return 0;
}

export function isNoAnswerLabel(label: string) {
  return /^(no sabe|ns\s*\/\s*nc|no contesta|prefiero no)/i.test(label.trim());
}
