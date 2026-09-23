import type { Emotion, SentimentLabel, SocialNetwork, SocialPost } from "@/lib/types";
import { addDays, dayKey, formatDayKey, mean, stdDev } from "@/lib/stats";

export type SocialFilters = {
  days: number;
  network?: SocialNetwork | null;
  topic?: string | null;
};

type Split = { positivo: number; neutral: number; negativo: number };

const emptySplit = (): Split => ({ positivo: 0, neutral: 0, negativo: 0 });

/**
 * Índice de humor: (positivas − negativas) / total, de −100 a +100. Pondera por
 * interacciones con raíz cuadrada: una publicación viral pesa más que una sin
 * eco, pero no tanto como para que un solo posteo defina el clima.
 */
function moodIndex(posts: SocialPost[]) {
  let pos = 0;
  let neg = 0;
  let total = 0;
  for (const p of posts) {
    const w = 1 + Math.sqrt(Math.max(0, p.engagement));
    total += w;
    if (p.label === "positivo") pos += w;
    if (p.label === "negativo") neg += w;
  }
  return total ? ((pos - neg) / total) * 100 : 0;
}

export function moodLabel(index: number) {
  if (index >= 35) return { text: "Muy positivo", tone: "success" as const };
  if (index >= 10) return { text: "Positivo", tone: "success" as const };
  if (index > -10) return { text: "Dividido", tone: "warning" as const };
  if (index > -35) return { text: "Negativo", tone: "danger" as const };
  return { text: "Muy negativo", tone: "danger" as const };
}

export type TopicStat = {
  name: string;
  volume: number;
  share: number;
  split: Split;
  mood: number;
  /** Cambio de volumen contra el período anterior, en %. null si no había menciones. */
  growth: number | null;
  moodDelta: number | null;
};

export type SocialAlert = {
  kind: "pico_negativo" | "tema_emergente" | "caida_humor";
  title: string;
  detail: string;
  day?: string;
  from?: string;
  topic?: string;
};

export type SocialAnalytics = {
  from: string;
  to: string;
  total: number;
  previousTotal: number;
  mood: number;
  previousMood: number | null;
  split: Split;
  engagement: number;
  daily: { key: string; name: string; positivo: number; neutral: number; negativo: number; mood: number | null }[];
  byNetwork: { network: SocialNetwork; volume: number; mood: number; split: Split }[];
  topics: TopicStat[];
  emotions: { emotion: Emotion; count: number; share: number }[];
  alerts: SocialAlert[];
  topNegative: SocialPost[];
  topPositive: SocialPost[];
  recent: SocialPost[];
  terms: { term: string; count: number; mood: number }[];
};

const STOP = new Set(
  "que los las del con una por para como pero mas este esta hay son muy todo nos les sus desde cuando donde porque ser fue van tiene tienen hace hoy ahora siempre gracias vecinos vecino barrio municipio san rafael".split(
    " ",
  ),
);

export function computeSocial(all: SocialPost[], filters: SocialFilters, today: string): SocialAnalytics {
  const days = Math.max(1, Math.min(365, filters.days));
  const from = addDays(today, -(days - 1));
  const prevFrom = addDays(from, -days);

  const scoped = all.filter(
    (p) => (!filters.network || p.network === filters.network) && (!filters.topic || p.topics.includes(filters.topic)),
  );
  const current = scoped.filter((p) => {
    const k = dayKey(p.published_at);
    return k >= from && k <= today;
  });
  // Solo se compara contra el período anterior si hay datos desde su comienzo:
  // si la escucha arrancó hace 40 días, "creció 300%" en 30 días es un artefacto.
  const earliest = all.reduce((min, p) => (p.published_at < min ? p.published_at : min), "9999");
  const comparable = earliest !== "9999" && dayKey(earliest) <= addDays(prevFrom, 2);
  const previous = comparable
    ? scoped.filter((p) => {
        const k = dayKey(p.published_at);
        return k >= prevFrom && k < from;
      })
    : [];

  const split = emptySplit();
  for (const p of current) split[p.label] += 1;

  // --- serie diaria ---------------------------------------------------------
  const byDay = new Map<string, SocialPost[]>();
  for (const p of current) {
    const k = dayKey(p.published_at);
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  const daily: SocialAnalytics["daily"] = [];
  for (let k = from; k <= today; k = addDays(k, 1)) {
    const posts = byDay.get(k) ?? [];
    const s = emptySplit();
    for (const p of posts) s[p.label] += 1;
    daily.push({ key: k, name: formatDayKey(k), ...s, mood: posts.length >= 3 ? Math.round(moodIndex(posts)) : null });
  }

  // --- redes ----------------------------------------------------------------
  const networks = new Map<SocialNetwork, SocialPost[]>();
  for (const p of current) networks.set(p.network, [...(networks.get(p.network) ?? []), p]);
  const byNetwork = [...networks.entries()]
    .map(([network, posts]) => {
      const s = emptySplit();
      for (const p of posts) s[p.label] += 1;
      return { network, volume: posts.length, mood: moodIndex(posts), split: s };
    })
    .sort((a, b) => b.volume - a.volume);

  // --- temas ------------------------------------------------------------------
  const topicNames = new Set([...current, ...previous].flatMap((p) => p.topics));
  const topics: TopicStat[] = [...topicNames]
    .map((name) => {
      const cur = current.filter((p) => p.topics.includes(name));
      const prev = previous.filter((p) => p.topics.includes(name));
      const s = emptySplit();
      for (const p of cur) s[p.label] += 1;
      return {
        name,
        volume: cur.length,
        share: current.length ? (cur.length / current.length) * 100 : 0,
        split: s,
        mood: moodIndex(cur),
        growth: prev.length ? ((cur.length - prev.length) / prev.length) * 100 : null,
        moodDelta: prev.length >= 5 && cur.length >= 5 ? moodIndex(cur) - moodIndex(prev) : null,
      };
    })
    .filter((t) => t.volume > 0)
    .sort((a, b) => b.volume - a.volume);

  // --- emociones ------------------------------------------------------------
  const emotionCounts = new Map<Emotion, number>();
  for (const p of current) if (p.emotion) emotionCounts.set(p.emotion, (emotionCounts.get(p.emotion) ?? 0) + 1);
  const withEmotion = [...emotionCounts.values()].reduce((s, v) => s + v, 0);
  const emotions = [...emotionCounts.entries()]
    .map(([emotion, count]) => ({ emotion, count, share: withEmotion ? (count / withEmotion) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  // --- alertas ----------------------------------------------------------------
  const alerts: SocialAlert[] = [];
  // Pico negativo: un día con más negativas que la media + 2 desvíos de los 14 anteriores.
  const negSeries = new Map<string, number>();
  for (const p of scoped) {
    if (p.label !== "negativo") continue;
    const k = dayKey(p.published_at);
    negSeries.set(k, (negSeries.get(k) ?? 0) + 1);
  }
  for (const d of daily) {
    const window = Array.from({ length: 14 }, (_, i) => negSeries.get(addDays(d.key, -(i + 1))) ?? 0);
    const m = mean(window) ?? 0;
    const sd = stdDev(window) ?? 0;
    // Tres condiciones para no alarmar por ruido: volumen mínimo, fuera de 2,5 desvíos y al menos el doble de lo habitual.
    if (d.negativo >= 10 && d.negativo > m + 2.5 * Math.max(sd, 1.5) && d.negativo >= 2 * m) {
      // Días consecutivos de pico son un mismo episodio: se informan juntos.
      const last = alerts.at(-1);
      if (last?.kind === "pico_negativo" && last.day === addDays(d.key, -1)) {
        const count = Number(last.detail.match(/^\d+/)?.[0] ?? 0) + d.negativo;
        last.from ??= last.day;
        last.title = `Pico de críticas del ${formatDayKey(last.from)} al ${d.name}`;
        last.detail = last.detail.replace(/^\d+/, String(count));
        last.day = d.key;
        continue;
      }
      const dayPosts = (byDay.get(d.key) ?? []).filter((p) => p.label === "negativo");
      const topicCount = new Map<string, number>();
      for (const p of dayPosts) for (const t of p.topics) topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
      const driver = [...topicCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      alerts.push({
        kind: "pico_negativo",
        day: d.key,
        topic: driver,
        title: `Pico de críticas el ${d.name}`,
        detail: `${d.negativo} publicaciones negativas contra un promedio de ${m.toFixed(1).replace(".", ",")} por día${driver ? `, sobre todo por «${driver}»` : ""}.`,
      });
    }
  }
  for (const t of topics) {
    if (t.growth !== null && t.growth >= 80 && t.volume >= 15) {
      alerts.push({
        kind: "tema_emergente",
        topic: t.name,
        title: `«${t.name}» crece en la conversación`,
        detail: `${t.volume} menciones, ${Math.round(t.growth)}% más que el período anterior, con humor ${moodLabel(t.mood).text.toLowerCase()}.`,
      });
    }
    if (t.moodDelta !== null && t.moodDelta <= -25 && t.volume >= 15) {
      alerts.push({
        kind: "caida_humor",
        topic: t.name,
        title: `Empeora el clima sobre «${t.name}»`,
        detail: `El índice cayó ${Math.round(Math.abs(t.moodDelta))} puntos respecto del período anterior.`,
      });
    }
  }

  // --- términos frecuentes ------------------------------------------------------
  const termStats = new Map<string, { count: number; score: number }>();
  for (const p of current) {
    const seen = new Set<string>();
    // Los nombres propios (barrios, calles, personas) inflan el ranking sin decir nada del
    // clima: se descarta toda palabra con mayúscula que no esté al comienzo de una oración.
    const words = p.text.split(/\s+/);
    const proper = new Set(
      words
        .filter((w, i) => i > 0 && /^[A-ZÁÉÍÓÚÑ]/.test(w) && !/[.!?]$/.test(words[i - 1]))
        .map((w) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zñ]/g, "")),
    );
    for (const raw of p.text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-zñ]+/)) {
      if (raw.length < 5 || STOP.has(raw) || seen.has(raw) || proper.has(raw)) continue;
      seen.add(raw);
      const s = termStats.get(raw) ?? { count: 0, score: 0 };
      s.count += 1;
      s.score += p.sentiment;
      termStats.set(raw, s);
    }
  }
  const terms = [...termStats.entries()]
    .filter(([, s]) => s.count >= 4)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 18)
    .map(([term, s]) => ({ term, count: s.count, mood: Math.round((s.score / s.count) * 100) }));

  const byImpact = (a: SocialPost, b: SocialPost) => b.engagement - a.engagement;

  return {
    from,
    to: today,
    total: current.length,
    previousTotal: previous.length,
    mood: moodIndex(current),
    previousMood: previous.length >= 10 ? moodIndex(previous) : null,
    split,
    engagement: current.reduce((s, p) => s + p.engagement, 0),
    daily,
    byNetwork,
    topics,
    emotions,
    alerts: alerts.slice(0, 6),
    topNegative: current.filter((p) => p.label === "negativo").sort(byImpact).slice(0, 6),
    topPositive: current.filter((p) => p.label === "positivo").sort(byImpact).slice(0, 6),
    recent: [...current].sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 12),
    terms,
  };
}

/** Resumen en texto para sumar al informe de IA o para "preguntale a los datos". */
export function socialBriefing(a: SocialAnalytics) {
  if (!a.total) return "";
  const pct = (n: number) => `${((n / a.total) * 100).toFixed(1).replace(".", ",")}%`;
  const lines = [
    `HUMOR EN REDES (${formatDayKey(a.from)} a ${formatDayKey(a.to)}; muestra no probabilística de publicaciones públicas)`,
    `Publicaciones analizadas: ${a.total}. Positivas ${pct(a.split.positivo)}, neutrales ${pct(a.split.neutral)}, negativas ${pct(a.split.negativo)}.`,
    `Indice de humor: ${Math.round(a.mood)} (de -100 a +100)${a.previousMood !== null ? `; periodo anterior ${Math.round(a.previousMood)}` : ""}.`,
    `Temas: ${a.topics
      .slice(0, 8)
      .map((t) => `${t.name} ${t.volume} menciones (humor ${Math.round(t.mood)})`)
      .join("; ")}.`,
  ];
  for (const al of a.alerts) lines.push(`Alerta: ${al.title}. ${al.detail}`);
  return lines.join("\n");
}

export const SENTIMENT_TONE: Record<SentimentLabel, "success" | "neutral" | "danger"> = {
  positivo: "success",
  neutral: "neutral",
  negativo: "danger",
};
