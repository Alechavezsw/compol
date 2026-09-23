import { variableLabel, type CrosstabFinding, type SurveyAnalytics } from "@/lib/analytics";
import { SMALL_BASE } from "@/lib/stats";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 3);

const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

/**
 * Respuesta sin modelo para la demo: ubica la pregunta del cuestionario que
 * más se parece a lo que se consultó y devuelve sus cifras con base y margen,
 * más los cruces significativos que la involucren. No interpreta: lee.
 */
export function answerLocally(a: SurveyAnalytics, findings: CrosstabFinding[], query: string): string {
  const words = new Set(normalize(query));
  if (!words.size) return "Escribí una pregunta un poco más concreta sobre los resultados.";

  // Por zona / por encuestador son consultas de operativo, no de una pregunta.
  if (/\b(zona|zonas|barrios?)\b/i.test(query) && !/\bgesti|problem|satisf|medio/i.test(query)) {
    return [
      `**Distribución por zona** (n=${a.totals.completed}):`,
      ...a.byZone.map((z) => `- ${z.name}: ${z.value} casos (${pct(z.percent)})`),
    ].join("\n");
  }

  const scored = a.questions
    .map((q) => {
      const haystack = new Set([
        ...normalize(q.question.text),
        ...normalize(q.question.section ?? ""),
        ...q.distribution.flatMap((d) => normalize(d.name)),
      ]);
      let score = 0;
      for (const w of words) {
        if (haystack.has(w)) score += 2;
        else if ([...haystack].some((h) => h.startsWith(w.slice(0, 5)) || w.startsWith(h.slice(0, 5)))) score += 1;
      }
      return { q, score };
    })
    .sort((x, y) => y.score - x.score);

  const best = scored[0];
  if (!best || best.score === 0) {
    return "No encontré una pregunta del cuestionario que se relacione con eso. Probá mencionando el tema (gestión, problemas, satisfacción, medios…).";
  }

  const q = best.q;
  const lines: string[] = [`**P${q.question.position}. ${q.question.text}** — base n=${q.answered}.`];
  if (q.answered < SMALL_BASE) lines.push("⚠ Base menor a 30 casos: la lectura no es firme.");
  if (q.condition) lines.push(`_${q.condition}._`);

  if (q.distribution.length && q.answered) {
    const top = [...q.distribution].sort((x, y) => y.value - x.value).slice(0, 4);
    for (const d of top) {
      lines.push(`- ${d.name}: **${pct(d.percent)}**${d.moe !== null ? ` (±${d.moe.toFixed(1).replace(".", ",")} pp)` : ""}`);
    }
    if (top.length >= 2 && top[0].moe !== null && top[0].percent - top[1].percent < (top[0].moe ?? 0)) {
      lines.push(`La diferencia entre «${top[0].name}» y «${top[1].name}» está dentro del margen de error: empate técnico.`);
    }
  }
  if (q.net) {
    lines.push(`Saldo neto: **${q.net.net >= 0 ? "+" : ""}${q.net.net.toFixed(1).replace(".", ",")} pp** (positivas ${pct(q.net.positive)}, negativas ${pct(q.net.negative)}).`);
  }
  if (q.average !== null) {
    lines.push(`Promedio ${q.average.toFixed(2).replace(".", ",")}${q.boxes ? `; valoración alta ${pct(q.boxes.top)}, baja ${pct(q.boxes.bottom)}` : ""}.`);
  }
  if (q.topTerms.length) {
    lines.push(`Términos que más se repiten: ${q.topTerms.slice(0, 6).map((t) => `${t.term} (${t.count})`).join(", ")}.`);
  }

  const related = findings.filter((f) => f.target.id === q.question.id).slice(0, 2);
  for (const f of related) {
    const h = f.highlights[0];
    lines.push(
      `Diferencia significativa según ${variableLabel(f.by)}: «${h.row}» llega a ${pct(h.percent)} en ${h.column} (n=${h.base}) contra ${pct(h.rest)} en el resto.`,
    );
  }

  lines.push("", "_Respuesta armada sin modelo de IA a partir de las cifras del tablero._");
  return lines.join("\n");
}
