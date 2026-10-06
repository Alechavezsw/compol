import type { SurveyAnalytics } from "@/lib/analytics";
import type { SocialAnalytics } from "@/lib/social/analytics";
import { NETWORK_LABEL } from "@/lib/types";

export const REPORT_PHOTOS = {
  cover: "/landing/civico.jpg",
  mid: "/landing/plaza.jpg",
  close: "/landing/parque.jpg",
} as const;

export const PAPER = {
  bg: "#fbf7f0",
  ink: "#1c1914",
  muted: "#6a6358",
  line: "#e6ddd0",
  card: "#fffdf8",
  accent: "#3d2de0",
  teal: "#0d7a6c",
} as const;

export const PAPER_BARS = ["#3d2de0", "#0d7a6c", "#c2410c", "#7c3aed", "#0284c7", "#b45309"];

export type ReportChart = {
  title: string;
  caption?: string;
  unit: "percent" | "score";
  rows: { name: string; percent: number; value: number }[];
};

const SKIP_QUESTION = /^(edad|g[eé]nero|sexo)$/i;
const SKIP_IF_ZONE = /departamento|en qu[eé] zona|barrio en que vive/i;

function shortLabel(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (/calles y veredas/i.test(cleaned)) return "Calles y veredas";
  if (/seguro/i.test(cleaned)) return "Seguridad en el barrio";
  if (/recolecci[oó]n/i.test(cleaned)) return "Recolección de residuos";
  if (/iluminaci[oó]n/i.test(cleaned)) return "Iluminación";
  const service = cleaned.match(/(?:evalúa(?:r)?(?: el estado de| la)?)\s+(.+?)[?.]?$/i);
  if (service?.[1] && service[1].length < 42) {
    return service[1].replace(/^(el|la|los|las)\s+/i, "").replace(/\?$/, "");
  }
  return cleaned.length > 52 ? `${cleaned.slice(0, 50)}…` : cleaned;
}

/** Elige 3 o 4 gráficos que cuenten el operativo, sin filtros ni demografía. */
export function pickReportCharts(analytics: SurveyAnalytics): ReportChart[] {
  const charts: ReportChart[] = [];

  if (analytics.byZone.length > 1) {
    charts.push({
      title: "Cobertura territorial",
      caption: "Casos completados por zona",
      unit: "percent",
      rows: analytics.byZone.map((z) => ({
        name: z.name,
        percent: z.percent,
        value: z.value,
      })),
    });
  }

  const scales = analytics.questions.filter((q) => q.question.type === "escala" && q.average !== null);
  if (scales.length >= 2) {
    const top = Math.max(...scales.map((q) => q.question.max_value ?? 10), 10);
    charts.push({
      title: "Valoración de servicios",
      caption: `Promedio en escala 1 a ${top}`,
      unit: "score",
      rows: scales.slice(0, 4).map((q) => ({
        name: shortLabel(q.question.text),
        percent: ((q.average ?? 0) / top) * 100,
        value: q.average ?? 0,
      })),
    });
  }

  for (const q of analytics.questions) {
    if (charts.length >= 4) break;
    const type = q.question.type;
    if (type === "texto_corto" || type === "texto_largo" || type === "numero" || type === "fecha") continue;
    if (type === "escala") continue;
    if (q.question.logic?.end_if?.length) continue;
    if (SKIP_QUESTION.test(q.question.text.trim())) continue;
    if (analytics.byZone.length > 1 && SKIP_IF_ZONE.test(q.question.text)) continue;
    if (q.distribution.length < 2 || q.answered < 8) continue;

    charts.push({
      title: q.question.text,
      caption: q.multiple
        ? "Respuesta múltiple · los porcentajes suman más de 100%"
        : q.condition ?? `n = ${q.answered}`,
      unit: "percent",
      rows: q.distribution
        .filter((d) => !d.exclusive || d.percent > 0)
        .slice(0, 7)
        .map((d) => ({ name: d.name, percent: d.percent, value: d.value })),
    });
  }

  return charts;
}

/** Gráficos del radar: tono, temas, días y fuentes. */
export function pickRadarCharts(a: SocialAnalytics): ReportChart[] {
  const charts: ReportChart[] = [];
  if (a.total) {
    charts.push({
      title: "Tono de las notas",
      caption: `${a.total} notas únicas del período`,
      unit: "percent",
      rows: [
        { name: "A favor", percent: (a.split.positivo / a.total) * 100, value: a.split.positivo },
        { name: "Neutras", percent: (a.split.neutral / a.total) * 100, value: a.split.neutral },
        { name: "En contra", percent: (a.split.negativo / a.total) * 100, value: a.split.negativo },
      ].filter((row) => row.value > 0),
    });
  }
  if (a.topics.length) {
    const top = a.topics.slice(0, 6);
    const max = Math.max(...top.map((t) => t.volume), 1);
    charts.push({
      title: "Temas en la conversación",
      caption: "Notas por tema",
      unit: "percent",
      rows: top.map((t) => ({
        name: t.name,
        percent: (t.volume / max) * 100,
        value: t.volume,
      })),
    });
  }
  const days = a.daily.filter((d) => d.positivo + d.neutral + d.negativo > 0).slice(-8);
  if (days.length > 1) {
    const max = Math.max(...days.map((d) => d.positivo + d.neutral + d.negativo), 1);
    charts.push({
      title: "Volumen día a día",
      caption: "Notas únicas por día",
      unit: "percent",
      rows: days.map((d) => {
        const value = d.positivo + d.neutral + d.negativo;
        return { name: d.name, percent: (value / max) * 100, value };
      }),
    });
  }
  if (a.byNetwork.length) {
    const max = Math.max(...a.byNetwork.map((n) => n.volume), 1);
    charts.push({
      title: "De dónde salen",
      caption: "Notas por fuente",
      unit: "percent",
      rows: a.byNetwork.map((n) => ({
        name: NETWORK_LABEL[n.network],
        percent: (n.volume / max) * 100,
        value: n.volume,
      })),
    });
  }
  return charts.slice(0, 4);
}

/** Saca menciones de modelo y el H1, que van en la tapa del documento. */
export function reportBodyMarkdown(markdown: string) {
  return markdown
    .replace(/^_.*?generado con .+?_\s*/gim, "")
    .replace(/^_.*?redactado sin modelo.+?_\s*/gim, "")
    .replace(/^#\s+.+\n+/, "")
    .trim();
}

export function markdownToSections(markdown: string) {
  const body = reportBodyMarkdown(markdown);
  if (!body) return [];

  return body
    .split(/\n(?=##\s)/)
    .map((block) => {
      const match = block.match(/^##\s+(.+)\n?([\s\S]*)$/);
      const raw = match ? match[2] : block;
      const title = match ? match[1].trim() : null;
      const text = raw
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/_(.+?)_/g, "$1")
        .replace(/`+/g, "")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^[-*]\s+/gm, "• ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return { title, text };
    })
    .filter((section) => section.title || section.text);
}
