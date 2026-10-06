import { variableLabel, type CrosstabFinding, type QuestionAnalytics, type SurveyAnalytics } from "@/lib/analytics";
import type { GeneratedReport } from "@/lib/ai/gemini";
import type { SocialAnalytics } from "@/lib/social/analytics";
import { SMALL_BASE, formatDayKey } from "@/lib/stats";
import { REPORT_KIND_LABEL, type ReportHighlight, type ReportKind } from "@/lib/types";

const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const pp = (n: number | null) => (n === null ? "s/d" : `±${n.toFixed(1).replace(".", ",")} pp`);
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1).replace(".", ",")} pp`;

function leader(q: QuestionAnalytics) {
  return [...q.distribution].filter((d) => !d.exclusive).sort((a, b) => b.value - a.value)[0];
}

/** ¿La primera opción le gana a la segunda por más que el margen? */
function isClearLead(q: QuestionAnalytics) {
  const [a, b] = [...q.distribution].sort((x, y) => y.value - x.value);
  if (!a || !b || a.moe === null) return true;
  return a.percent - b.percent > a.moe;
}

function findingSentence(f: CrosstabFinding) {
  const h = f.highlights[0];
  const by = variableLabel(f.by);
  return `En «${f.target.text}», la respuesta **${h.row}** llega a **${pct(h.percent)}** en ${h.column} (n=${h.base}), contra ${pct(h.rest)} en el resto (${signed(h.percent - h.rest)}). La diferencia por ${by} es estadísticamente significativa.`;
}

/**
 * Redactor de respaldo para la demo cuando no hay GEMINI_API_KEY.
 *
 * No imita a un modelo: arma cada tipo de informe con plantilla sobre las
 * mismas cifras agregadas que recibiría Gemini (incluidos margen de error y
 * cruces significativos). Describe y ordena; no interpreta. El campo `model`
 * lo deja explícito para que nadie lo confunda con una salida del motor real.
 */
export function buildLocalReport(params: {
  analytics: SurveyAnalytics;
  findings?: CrosstabFinding[];
  social?: SocialAnalytics | null;
  organizationName: string;
  kind: ReportKind;
  audience?: string | null;
  focus?: string | null;
}): GeneratedReport {
  const { analytics, findings = [], social, organizationName, kind, audience, focus } = params;
  const { survey, totals, questions, byZone, bySurveyor, pace, quality } = analytics;

  const opinion = questions.filter(
    (q) =>
      q.answered > 0 &&
      q.distribution.length > 0 &&
      !q.question.logic?.end_if?.length &&
      (q.question.section ?? "").toLowerCase() !== "perfil",
  );
  const withNet = opinion.filter((q) => q.net);
  const scales = questions.filter((q) => q.average !== null && q.question.type === "escala");
  const open = questions.filter((q) => q.samples.length > 0);
  const smallBases = questions.filter((q) => q.answered > 0 && q.answered < SMALL_BASE);

  // --- Hallazgos: saldos netos, líderes claros y cruces significativos ------
  const highlights: ReportHighlight[] = [];
  for (const q of withNet.slice(0, 2)) {
    highlights.push({
      titulo: q.question.text,
      detalle: `Las respuestas positivas suman ${pct(q.net!.positive)} y las negativas ${pct(q.net!.negative)}.`,
      metrica: `Neto ${signed(q.net!.net)} (n=${q.answered})`,
    });
  }
  for (const q of opinion.filter((q) => !q.net && q.question.type !== "si_no").slice(0, 2)) {
    const top = leader(q);
    if (!top) continue;
    highlights.push({
      titulo: q.question.text,
      detalle: isClearLead(q)
        ? `«${top.name}» encabeza con ventaja por encima del margen de error.`
        : `«${top.name}» aparece primera, pero en empate técnico con la siguiente opción.`,
      metrica: `${pct(top.percent)} ${pp(top.moe)} (n=${q.answered})`,
    });
  }
  for (const f of findings.slice(0, 2)) {
    const h = f.highlights[0];
    highlights.push({
      titulo: `${h.row} en ${h.column}`,
      detalle: `En «${f.target.text}» este segmento se despega del resto de la muestra.`,
      metrica: `${pct(h.percent)} vs ${pct(h.rest)} (n=${h.base})`,
    });
  }

  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(`# ${REPORT_KIND_LABEL[kind]}: ${survey.title}`);
  push(`_${organizationName} · ${totals.completed} casos completados_`);

  // --- Resumen: común a todos los tipos ----------------------------------
  push("\n## Resumen ejecutivo\n");
  push(
    `El relevamiento **${survey.title}** reúne **${totals.completed} entrevistas completas** sobre una meta de ${totals.target} ` +
      `(${pct(totals.progress)} de avance), con un margen de error máximo de **${pp(totals.moe)}** al 95% de confianza.` +
      (survey.geography ? ` Ámbito: ${survey.geography}.` : ""),
  );
  if (withNet[0]) {
    const q = withNet[0];
    push(
      `\nEn «${q.question.text}», las evaluaciones positivas suman ${pct(q.net!.positive)} y las negativas ${pct(q.net!.negative)}, ` +
        `un saldo neto de **${signed(q.net!.net)}**.`,
    );
  }
  if (findings[0]) push(`\n${findingSentence(findings[0])}`);
  if (audience) push(`\nDocumento dirigido a: ${audience}.`);
  if (focus) push(`\nFoco solicitado: ${focus}.`);

  push("\n## Hallazgos principales\n");
  for (const h of highlights.slice(0, 6)) push(`**${h.titulo}** — ${h.metrica}\n\n${h.detalle}\n`);

  // --- Cuerpo según el tipo ----------------------------------------------
  if (kind === "ejecutivo") {
    push("\n## Qué dice la opinión\n");
    for (const q of opinion.slice(0, 5)) {
      const top = leader(q);
      if (!top) continue;
      push(
        `- **${q.question.text}** ${q.net ? `Neto ${signed(q.net.net)}.` : `Primera respuesta: ${top.name} (${pct(top.percent)}).`}` +
          `${isClearLead(q) ? "" : " Sin diferencia clara con la segunda opción."}`,
      );
    }
    for (const q of scales) {
      push(`- **${q.question.text}** Promedio ${q.average!.toFixed(1).replace(".", ",")}${q.boxes ? `; ${pct(q.boxes.top)} valora alto y ${pct(q.boxes.bottom)} bajo` : ""}.`);
    }
    push("\n## Qué mirar en la próxima medición\n");
    push(
      [
        ...findings.slice(0, 2).map((f) => `- La brecha de «${f.highlights[0].row}» en ${f.highlights[0].column}.`),
        ...withNet.slice(0, 1).map((q) => `- La evolución del saldo neto de «${q.question.text}».`),
        "- Si las diferencias entre zonas se sostienen con una muestra completa.",
      ].join("\n"),
    );
  }

  if (kind === "tecnico") {
    push("\n## Ficha técnica\n");
    push(
      [
        "| Dato | Valor |",
        "| --- | --- |",
        `| Casos completos | ${totals.completed} de ${totals.target} (${pct(totals.progress)}) |`,
        `| Margen de error máximo | ${pp(totals.moe)} (95%, MAS, p=0,5) |`,
        `| Descartadas por filtro | ${totals.discarded} (incidencia ${totals.incidence === null ? "s/d" : pct(totals.incidence)}) |`,
        `| Duración mediana | ${totals.medianDurationSeconds ? `${Math.round(totals.medianDurationSeconds / 60)} min` : "s/d"} |`,
        `| Metodología | ${survey.methodology ?? "no declarada"} |`,
        `| Ritmo últimos 7 días | ${pace.perDayLast7.toFixed(1).replace(".", ",")} casos/día |`,
      ].join("\n"),
    );
    if (byZone.length) {
      push("\n## Composición de la muestra por zona\n");
      push("| Zona | Casos | % |", "| --- | ---: | ---: |");
      for (const z of byZone) push(`| ${z.name} | ${z.value} | ${pct(z.percent)} |`);
    }
    push("\n## Resultados por pregunta\n");
    for (const q of questions.filter((q) => q.distribution.length && q.answered)) {
      push(`### P${q.question.position}. ${q.question.text}`);
      push(`Base: ${q.answered} casos${q.condition ? ` · ${q.condition}` : ""}${q.multiple ? " · respuesta múltiple" : ""}.\n`);
      push("| Respuesta | Casos | % | Margen |", "| --- | ---: | ---: | ---: |");
      for (const d of q.distribution) push(`| ${d.name} | ${d.value} | ${pct(d.percent)} | ${pp(d.moe)} |`);
      if (q.average !== null) push(`\nPromedio ${q.average.toFixed(2)} · mediana ${q.median ?? "s/d"} · desvío ${q.stdDev?.toFixed(2) ?? "s/d"}`);
      push("");
    }
    push("\n## Control de calidad del campo\n");
    push(
      quality.expressCount
        ? `Se detectaron **${quality.expressCount} entrevistas exprés** (menos de ${quality.expressThreshold} segundos, el 40% de la mediana). ` +
            `Se concentran en: ${bySurveyor.filter((s) => s.express).map((s) => `${s.name} (${s.express})`).join(", ")}. Se recomienda auditarlas antes del cierre.`
        : "No se detectaron entrevistas con duraciones anómalas.",
    );
    const stale = bySurveyor.filter((s) => s.daysSinceLast !== null && s.daysSinceLast >= 2);
    if (stale.length) {
      push(`\nEncuestadores sin carga en las últimas 48 horas: ${stale.map((s) => `${s.name} (hace ${s.daysSinceLast} días)`).join(", ")}.`);
    }
  }

  if (kind === "comunicacional") {
    push("\n## Titulares posibles\n");
    const heads = [
      ...withNet.slice(0, 1).map((q) => `- «${q.net!.net >= 0 ? "Predomina la mirada positiva" : "Predomina la mirada crítica"}: ${pct(Math.max(q.net!.positive, q.net!.negative))} sobre ${q.question.text.replace(/^¿|\?$/g, "").toLowerCase()}»`),
      ...opinion
        .filter((q) => q.multiple)
        .slice(0, 1)
        .map((q) => `- «${leader(q)?.name} encabeza la agenda: la menciona el ${pct(leader(q)?.percent ?? 0)}»`),
      ...findings.slice(0, 1).map((f) => `- «En ${f.highlights[0].column}, ${f.highlights[0].row.toLowerCase()} llega al ${pct(f.highlights[0].percent)}»`),
    ];
    push(heads.join("\n") || "- No hay diferencias suficientemente claras para titular.");

    push("\n## Datos placa\n");
    for (const q of opinion.filter(isClearLead).slice(0, 4)) {
      const top = leader(q);
      if (top) push(`> **${pct(top.percent)}** — ${top.name.toLowerCase()} (${q.question.text.replace(/^¿|\?$/g, "")})\n`);
    }

    push("\n## Qué NO afirmar\n");
    const cautions = [
      ...opinion
        .filter((q) => !isClearLead(q))
        .slice(0, 3)
        .map((q) => {
          const [a, b] = [...q.distribution].sort((x, y) => y.value - x.value);
          return `- No decir que «${a.name}» supera a «${b.name}» en «${q.question.text}»: la diferencia está dentro del margen de error.`;
        }),
      ...smallBases.map((q) => `- No publicar porcentajes de «${q.question.text}»: la base es de solo ${q.answered} casos.`),
      totals.progress < 100 ? `- No presentar los resultados como definitivos: el campo está al ${pct(totals.progress)} de la meta.` : null,
    ].filter(Boolean) as string[];
    push(cautions.join("\n") || "- Todas las cifras destacadas superan el margen de error.");
  }

  if (kind === "comparativo") {
    push("\n## Diferencias significativas entre segmentos\n");
    if (!findings.length) {
      push("Con la base actual no se detectan diferencias estadísticamente significativas entre zonas ni segmentos de perfil.");
    }
    for (const f of findings) {
      push(`### ${f.target.text} — según ${variableLabel(f.by)}`);
      push("| Respuesta | Segmento | Segmento % | Resto % | Diferencia | Base |", "| --- | --- | ---: | ---: | ---: | ---: |");
      for (const h of f.highlights) {
        push(`| ${h.row} | ${h.column} | ${pct(h.percent)} | ${pct(h.rest)} | ${signed(h.percent - h.rest)} | ${h.base} |`);
      }
      push(f.pValue !== null ? `\nPrueba chi-cuadrado: p ${f.pValue < 0.001 ? "< 0,001" : `= ${f.pValue.toFixed(3).replace(".", ",")}`}.\n` : "\nRespuesta múltiple: prueba por celda.\n");
    }
    if (byZone.some((z) => z.value < SMALL_BASE)) {
      push(`\nZonas con menos de ${SMALL_BASE} casos (${byZone.filter((z) => z.value < SMALL_BASE).map((z) => z.name).join(", ")}) quedan fuera de la comparación firme.`);
    }
  }

  if (open.length && kind !== "tecnico") {
    push("\n## La voz de los encuestados\n");
    for (const q of open) {
      if (q.topTerms.length) push(`Términos más repetidos: ${q.topTerms.slice(0, 6).map((t) => `**${t.term}** (${t.count})`).join(", ")}.\n`);
      for (const s of q.samples.slice(0, kind === "comunicacional" ? 3 : 5)) push(`> ${s}\n`);
    }
  }

  if (social && social.total && kind !== "tecnico") {
    const share = (n: number) => pct((n / social.total) * 100);
    push("\n## Contexto: humor en redes (últimos 30 días)\n");
    push(
      `Sobre ${social.total} publicaciones públicas, el índice de humor es **${Math.round(social.mood)}** (de −100 a +100): ` +
        `${share(social.split.positivo)} positivas y ${share(social.split.negativo)} negativas.`,
    );
    const top = social.topics.slice(0, 4);
    if (top.length) {
      push(`\nTemas con más conversación: ${top.map((t) => `**${t.name}** (${t.volume}, humor ${Math.round(t.mood)})`).join(", ")}.`);
    }
    for (const al of social.alerts.slice(0, 2)) push(`\n- ${al.title}: ${al.detail}`);
    push("\n_Las redes no son una muestra representativa: sirven para leer agenda y picos, no para medir la opinión general._");
  }

  push("\n## Advertencias metodológicas\n");
  push(
    [
      "Este informe fue armado con una plantilla local, no con un modelo de lenguaje. Ordena y describe los datos, pero no interpreta.",
      `El margen de error supone muestreo aleatorio simple${survey.methodology?.toLowerCase().includes("cuota") ? "; el campo es por cuotas, así que debe leerse como referencia" : ""}.`,
      totals.progress < 100
        ? `El operativo está al ${pct(totals.progress)} de la meta${pace.eta ? ` (al ritmo actual se completa el ${formatDayKey(pace.eta)})` : ""}: los resultados son parciales.`
        : null,
      smallBases.length ? `Hay ${smallBases.length} pregunta(s) con menos de ${SMALL_BASE} respuestas: sus porcentajes no sostienen una lectura firme.` : null,
      questions.some((q) => q.condition) ? "Las preguntas condicionales tienen como base solo a quienes cumplían la condición." : null,
      analytics.filtered ? "Los resultados corresponden a un recorte filtrado de la muestra." : null,
    ]
      .filter(Boolean)
      .map((a) => `- ${a}`)
      .join("\n"),
  );

  push("\n## Recomendaciones\n");
  push(
    [
      "Cargar `GEMINI_API_KEY` para que el motor de IA redacte el análisis interpretativo sobre estas mismas cifras.",
      pace.status === "atrasada" && pace.requiredPerDay
        ? `Reforzar el campo: hacen falta ${Math.ceil(pace.requiredPerDay)} casos por día para llegar a la fecha de cierre.`
        : totals.progress < 100
          ? "Completar la meta muestral antes de comunicar resultados hacia afuera."
          : "Con la meta cumplida, los resultados ya admiten difusión.",
      quality.expressCount ? "Auditar las entrevistas exprés antes de dar por cerrada la base." : null,
      bySurveyor.some((s) => s.quota && s.value < s.quota * 0.5)
        ? "Revisar la carga de los encuestadores que están por debajo de la mitad de su cuota."
        : null,
    ]
      .filter(Boolean)
      .map((r) => `- ${r}`)
      .join("\n"),
  );

  return {
    title: `${REPORT_KIND_LABEL[kind]}: ${survey.title}`.slice(0, 140),
    markdown: lines.join("\n"),
    highlights: highlights.slice(0, 6),
    model: "plantilla local (sin modelo)",
  };
}

export function buildLocalRadarReport(params: {
  social: SocialAnalytics;
  organizationName: string;
}): GeneratedReport {
  const { social, organizationName } = params;
  const share = (n: number) => pct((n / Math.max(1, social.total)) * 100);
  const highlights: ReportHighlight[] = [
    {
      titulo: "Humor del período",
      detalle: `Sobre ${social.total} notas únicas, ${share(social.split.positivo)} van a favor y ${share(social.split.negativo)} en contra.`,
      metrica: `${social.mood >= 0 ? "+" : ""}${Math.round(social.mood)}`,
    },
  ];
  for (const t of social.topics.slice(0, 3)) {
    highlights.push({
      titulo: t.name,
      detalle: `${t.volume} notas, humor ${Math.round(t.mood)}.`,
      metrica: `${t.volume}`,
    });
  }

  const parts = [
    `# Qué se dice de ${organizationName}`,
    `_${organizationName} · radar de conversación · ${formatDayKey(social.from)} a ${formatDayKey(social.to)}_`,
    "\n## Resumen ejecutivo\n",
    `El radar reunió **${social.total} notas únicas** de portales públicos. El índice de humor queda en **${Math.round(social.mood)}** (de −100 a +100): ${share(social.split.positivo)} a favor, ${share(social.split.neutral)} neutrales y ${share(social.split.negativo)} en contra.`,
  ];
  if (social.topics.length) {
    parts.push("\n## Temas\n");
    parts.push(
      social.topics
        .slice(0, 6)
        .map((t) => `- **${t.name}**: ${t.volume} notas, humor ${Math.round(t.mood)}.`)
        .join("\n"),
    );
  }
  if (social.recent.length) {
    parts.push("\n## Notas que marcan agenda\n");
    parts.push(social.recent.slice(0, 6).map((p) => `- ${p.text.split(/\s+-\s+/)[0]}`).join("\n"));
  }
  parts.push("\n## Advertencias metodológicas\n");
  parts.push(
    [
      "- Este texto ordena las cifras del radar. No es una encuesta ni una muestra representativa.",
      "- Las notas se agrupan por historia para no contar dos veces la misma noticia.",
      "- Sirve para leer agenda y tono, no para medir la opinión general de la ciudad.",
    ].join("\n"),
  );

  return {
    title: `Qué se dice de ${organizationName}`.slice(0, 140),
    markdown: parts.join("\n"),
    highlights: highlights.slice(0, 6),
    model: "plantilla local (sin modelo)",
  };
}
