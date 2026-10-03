import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Clock,
  Download,
  Filter as FilterIcon,
  GitBranch,
  Globe,
  Layers,
  MapPin,
  Sparkles,
  Target,
  Timer,
  UserX,
  Users,
} from "lucide-react";
import { EmptyState, Notice, PageHeader, Progress, ProgressRing, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, SurveyStatusBadge, type Tone } from "@/components/ui/badge";
import { FieldTrend } from "@/components/charts/charts";
import { DistributionBars, NetBar, ScaleColumns } from "@/components/results/distribution-bars";
import { CrosstabTable } from "@/components/results/crosstab-table";
import { CrosstabPicker, FilterBar } from "@/components/results/controls";
import { AskBox } from "@/components/results/ask-box";
import { FieldMap } from "@/components/results/field-map";
import { caseForAnswers, pickEvaluationQuestion } from "@/lib/case-tone";
import { LiveRefresh } from "@/components/results/live-refresh";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import {
  applyFilters,
  computeAnalytics,
  computeCrosstab,
  isCrossable,
  isProfileVariable,
  keyFindings,
  loadSurveyData,
  segmentVariables,
  type Pace,
  type QuestionAnalytics,
} from "@/lib/analytics";
import { filtersFromParams, filtersToQuery } from "@/lib/filters";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { SMALL_BASE, dayKey, formatDayKey, scaleBoxes } from "@/lib/stats";
import { cn, formatDuration, formatNumber, formatPercent } from "@/lib/utils";
import { QUESTION_TYPE_LABEL } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("surveys").select("title").eq("id", id).maybeSingle();
  return { title: data ? `Resultados · ${data.title}` : "Resultados" };
}

const pp = (n: number | null) => (n === null ? "—" : `±${n.toFixed(1).replace(".", ",")} pp`);

const PACE: Record<Pace["status"], { label: string; tone: Tone }> = {
  cumplida: { label: "Meta cumplida", tone: "success" },
  en_ritmo: { label: "En ritmo", tone: "success" },
  atrasada: { label: "Atrasada", tone: "danger" },
  sin_ritmo: { label: "Sin carga en 7 días", tone: "warning" },
  sin_fecha: { label: "Sin fecha de cierre", tone: "neutral" },
};

export default async function ResultadosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const data = await loadSurveyData(supabase, id);
  if (!data || data.survey.organization_id !== organization.id) notFound();

  const filters = filtersFromParams(query);
  const analytics = computeAnalytics(data, filters);
  const { survey, totals, daily, pace, byZone, bySurveyor, quality, questions } = analytics;
  const findings = keyFindings(data, filters, 6);
  const variables = segmentVariables(data);
  const hasAnyData = totals.completedAll > 0;
  const hasData = totals.completed > 0;

  // --- Cruce elegido: el de la URL o, por defecto, el hallazgo más fuerte ---
  const crossTargets = data.questions.filter((q) => isCrossable(q) && !q.logic?.end_if?.length);
  const pick = (key: string) => (Array.isArray(query[key]) ? query[key]?.[0] : query[key]) as string | undefined;
  const target =
    pick("cruce") ??
    findings[0]?.target.id ??
    crossTargets.find((q) => (q.section ?? "").toLowerCase() !== "perfil")?.id ??
    crossTargets[0]?.id;
  const by =
    pick("por") ??
    (findings[0]?.target.id === target ? findings[0]?.by.id : undefined) ??
    variables.find((v) => v.id !== target && isProfileVariable(v, data))?.id ??
    variables.find((v) => v.id !== target)?.id;
  const crosstab = target && by ? computeCrosstab(data, filters, target, by) : null;

  const zones = [
    ...new Set(
      data.responses
        .filter((r) => r.status === "completada" && !(r.channel === "web" && !r.zone))
        .map((r) => r.zone?.trim() || "Sin zona"),
    ),
  ].sort();
  const channels = [...new Set(data.responses.map((r) => r.channel ?? "campo"))];
  const surveyors = [...new Set(data.assignments.map((a) => a.surveyor_id))].map((sid) => ({
    id: sid,
    name: data.names.get(sid) ?? "Encuestador",
  }));
  const days = data.responses.map((r) => r.submitted_at).filter((d): d is string => Boolean(d)).map((d) => dayKey(d)).sort();
  const exportQuery = filtersToQuery(filters);
  const suggestions = questions
    .filter((q) => !q.question.logic?.end_if?.length && (q.question.section ?? "").toLowerCase() !== "perfil")
    .filter((q) => q.distribution.length || q.samples.length)
    .slice(0, 3)
    .map((q) => q.question.text)
    .concat(findings[0] ? [`¿Hay diferencias por ${findings[0].by.kind === "zone" ? "zona" : "edad o perfil"}?`] : []);

  const paceInfo = PACE[pace.status];

  const evaluation = pickEvaluationQuestion(data.questions);
  const geoPoints = applyFilters(data, data.responses, filters)
    .filter(
      (r): r is typeof r & { latitude: number; longitude: number } =>
        r.status === "completada" && r.latitude !== null && r.longitude !== null,
    )
    .map((r) => {
      const tone = caseForAnswers(evaluation, data.values.get(r.id));
      return {
        id: r.id,
        lat: r.latitude,
        lng: r.longitude,
        zone: r.zone,
        channel: (r.channel ?? "campo") as "campo" | "web",
        submittedAt: r.submitted_at,
        tone: tone.tone,
        toneLabel: tone.label,
      };
    });

  return (
    <div className="space-y-6">
      {survey.status === "activa" ? <LiveRefresh /> : null}
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <SurveyStatusBadge status={survey.status} />
            <Badge tone="neutral">{survey.geography ?? "Sin ámbito"}</Badge>
            {survey.status === "activa" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--success)]">
                <span className="size-1.5 rounded-full bg-current animate-pulse-soft" />
                En vivo
              </span>
            ) : null}
          </div>
        }
        title={survey.title}
        description={
          hasAnyData
            ? `${formatNumber(totals.completed)} casos ${analytics.filtered ? "en el recorte" : "completados"} · margen de error ${pp(totals.moe)} al 95%${survey.methodology ? ` · ${survey.methodology}` : ""}`
            : survey.description ?? undefined
        }
        actions={
          <>
            <ButtonLink href={`/cliente/encuestas/${id}`} variant="outline">
              Cuestionario
            </ButtonLink>
            {hasAnyData ? (
              <a
                href={`/cliente/encuestas/${id}/exportar${exportQuery ? `?${exportQuery}` : ""}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-all hover:border-[color-mix(in_oklab,var(--primary)_28%,var(--border))] hover:bg-[var(--surface-2)]"
              >
                <Download className="size-4" />
                CSV
              </a>
            ) : null}
            {profile.role === "org_admin" && hasAnyData ? (
              <ButtonLink href={`/cliente/informes?encuesta=${id}`}>
                <Sparkles />
                Generar informe
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {!hasAnyData ? (
        <EmptyState
          icon={<Target className="size-5" />}
          title="Todavía no hay casos completados"
          description="En cuanto los encuestadores empiecen a cargar entrevistas, el tablero se llena solo."
        />
      ) : (
        <>
          <FilterBar
            zones={zones}
            surveyors={surveyors}
            segments={variables.filter((v) => v.kind === "question")}
            channels={channels}
            minDay={days[0]}
            maxDay={days.at(-1)}
          />

          <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {[
              ["#campo", "Campo"],
              ["#hallazgos", "Hallazgos"],
              ["#cruces", "Cruces"],
              ["#preguntas", "Pregunta por pregunta"],
              ...(bySurveyor.length ? [["#equipo", "Equipo y calidad"]] : []),
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                {label}
              </a>
            ))}
          </nav>

          {analytics.filtered ? (
            <Notice tone="primary" icon={<FilterIcon />}>
              Estás viendo un recorte de {formatNumber(totals.completed)} de {formatNumber(totals.completedAll)} casos. Los
              porcentajes y márgenes se calculan sobre el recorte; el avance y la proyección, sobre el total.
            </Notice>
          ) : null}

          {/* ------------------------------------------------------ KPIs */}
          <section id="campo" className="grid scroll-mt-28 gap-4 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-5 shadow-[var(--shadow-card)] lg:col-span-2">
              <div className="orb -top-20 -right-16 size-48 bg-[var(--primary)] opacity-10" />
              <div className="relative flex items-center gap-5">
                <ProgressRing value={totals.completedAll} max={totals.target} size={112} stroke={11} tone={pace.status === "atrasada" ? "warning" : "primary"}>
                  <span className="display text-[26px] leading-none tabular-nums">{Math.round(totals.progress)}%</span>
                  <span className="mt-0.5 text-[10px] text-[var(--muted)]">de la meta</span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-[var(--muted)]">Avance del operativo</p>
                    <Badge tone={paceInfo.tone} dot>
                      {paceInfo.label}
                    </Badge>
                  </div>
                  <p className="display mt-1 text-[34px] leading-none tabular-nums">
                    {formatNumber(totals.completedAll)}
                    <span className="ml-1.5 text-lg text-[var(--muted)]">/ {formatNumber(totals.target)}</span>
                  </p>
                  <p className="mt-2 text-sm leading-snug text-[var(--muted)]">
                    {pace.status === "cumplida"
                      ? "La meta muestral ya está cubierta."
                      : pace.eta
                        ? (
                            <>
                              A {pace.perDayLast7.toFixed(1).replace(".", ",")} casos/día, la meta se alcanza el{" "}
                              <strong className="font-semibold text-[var(--foreground)]">{formatDayKey(pace.eta)}</strong>
                              {pace.endsAt ? <> · cierre previsto {formatDayKey(pace.endsAt)}</> : null}.
                            </>
                          )
                        : "No hubo carga en los últimos 7 días: no se puede proyectar el cierre."}
                  </p>
                  {pace.status === "atrasada" && pace.requiredPerDay ? (
                    <p className="mt-1.5 text-xs font-medium text-[var(--danger)]">
                      Para llegar a tiempo hacen falta {Math.ceil(pace.requiredPerDay)} casos por día.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <StatCard
              label="Incidencia del filtro"
              value={totals.incidence === null ? "—" : formatPercent(totals.incidence)}
              icon={<UserX className="size-4" />}
              tone="warning"
              hint={`${formatNumber(totals.discarded)} descartadas · ${formatNumber(totals.inProgress)} en curso`}
            />
            <StatCard
              label="Duración mediana"
              value={formatDuration(totals.medianDurationSeconds)}
              icon={<Timer className="size-4" />}
              tone={quality.expressCount ? "warning" : "accent"}
              hint={
                quality.expressCount ? (
                  <span className="font-medium text-[var(--warning)]">
                    {formatNumber(quality.expressCount)} entrevistas exprés a revisar
                  </span>
                ) : (
                  "Sin entrevistas sospechosamente cortas"
                )
              }
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <div>
                  <CardTitle>Evolución del campo</CardTitle>
                  <p className="mt-1 text-sm text-[var(--muted)]">Casos por día y acumulado contra la meta</p>
                </div>
                <div className="flex gap-4 text-xs text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-[var(--chart-1)]" /> Día
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded bg-[var(--chart-2)]" /> Acumulado
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {daily.length ? (
                  <FieldTrend data={daily} target={analytics.filtered ? undefined : totals.target} />
                ) : (
                  <p className="py-16 text-center text-sm text-[var(--muted)]">Sin casos en el recorte elegido.</p>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  {byZone.length ? <MapPin className="size-4 text-[var(--muted)]" /> : <Globe className="size-4 text-[var(--muted)]" />}
                  <CardTitle>{byZone.length ? "Distribución por zona" : "Desde dónde responden"}</CardTitle>
                </div>
                <span className="text-xs text-[var(--muted)]">n = {formatNumber(totals.completed)}</span>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {analytics.byChannel.length > 1 ? (
                  <div className="flex h-9 overflow-hidden rounded-xl text-xs font-semibold">
                    {analytics.byChannel.map((c) => (
                      <div
                        key={c.key}
                        className={cn("flex items-center justify-center px-2 text-white", c.key === "web" ? "bg-[var(--accent)]" : "bg-[var(--primary)]")}
                        style={{ width: `${Math.max(12, c.percent)}%` }}
                        title={`${c.name}: ${formatNumber(c.value)}`}
                      >
                        {c.key === "web" ? "Web" : "Campo"} {Math.round(c.percent)}%
                      </div>
                    ))}
                  </div>
                ) : null}
                {byZone.length ? (
                  <DistributionBars data={byZone} showMoe={false} multiple />
                ) : analytics.bySource.length ? (
                  <DistributionBars data={analytics.bySource} showMoe={false} multiple />
                ) : null}
                {byZone.length && analytics.bySource.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Origen web</p>
                    <DistributionBars data={analytics.bySource.slice(0, 4)} showMoe={false} multiple />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {geoPoints.length ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-[var(--muted)]" />
                  <CardTitle>Mapa de campo</CardTitle>
                </div>
                <span className="text-xs text-[var(--muted)]">n = {formatNumber(geoPoints.length)}</span>
              </CardHeader>
              <CardContent className="pt-4">
                <FieldMap points={geoPoints} />
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Cada punto es un caso. El color es la evaluación de la gestión: muy buena, buena,
                  regular, mala o muy mala. La ubicación es aproximada por zona.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <AskBox surveyId={id} filters={filters} suggestions={suggestions} withModel={isGeminiConfigured()} />

          {!hasData ? (
            <EmptyState
              icon={<FilterIcon className="size-5" />}
              title="Ningún caso cumple los filtros"
              description="Probá ampliar el rango de fechas o quitar algún filtro."
            />
          ) : (
            <>
              {/* -------------------------------------------------- hallazgos */}
              <section id="hallazgos" className="scroll-mt-28 space-y-3">
                <SectionTitle
                  icon={<Layers className="size-4" />}
                  title="Diferencias que importan"
                  description="Cruces con diferencias estadísticamente significativas (95%) y base de al menos 30 casos por segmento."
                />
                {findings.length === 0 ? (
                  <Notice icon={<Layers />}>
                    No aparecen diferencias significativas entre segmentos con la base actual. Con más casos, o sin
                    filtros, pueden empezar a aparecer.
                  </Notice>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {findings.map((f) => {
                      const h = f.highlights[0];
                      const up = h.percent > h.rest;
                      const href = `?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(filtersToQuery(filters))), cruce: f.target.id, por: f.by.id }).toString()}#cruces`;
                      return (
                        <Link
                          key={`${f.target.id}-${f.by.id}`}
                          href={href}
                          scroll={false}
                          className="group relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-xs font-medium text-[var(--muted)]">
                              P{f.target.position}. {f.target.text}
                            </p>
                            <span
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-xl",
                                up ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft)] text-[var(--danger)]",
                              )}
                            >
                              {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-snug text-[var(--foreground)]">
                            <strong className="font-semibold">«{h.row}»</strong> llega a{" "}
                            <span className="display text-xl tabular-nums">{formatPercent(h.percent)}</span> en{" "}
                            <strong className="font-semibold">{h.column}</strong>
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            vs {formatPercent(h.rest)} en el resto · {up ? "+" : "−"}
                            {Math.abs(h.percent - h.rest).toFixed(1).replace(".", ",")} pp · n={formatNumber(h.base)}
                          </p>
                          <p className="mt-3 text-[11px] font-medium text-[var(--primary)] opacity-0 transition-opacity group-hover:opacity-100">
                            Ver el cruce completo →
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ---------------------------------------------------- cruces */}
              <section id="cruces" className="scroll-mt-28">
                <Card>
                  <CardHeader>
                    <div>
                      <div className="flex items-center gap-2">
                        <GitBranch className="size-4 text-[var(--muted)]" />
                        <CardTitle>Explorador de cruces</CardTitle>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Abrí cualquier resultado por zona o por una variable de perfil.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-4">
                    <CrosstabPicker
                      targets={crossTargets.map((q) => ({ value: q.id, label: `P${q.position}. ${q.text}` }))}
                      variables={variables.map((v) => ({ value: v.id, label: v.label }))}
                      target={target ?? ""}
                      by={by ?? ""}
                    />
                    {crosstab && crosstab.totalBase > 0 ? (
                      <CrosstabTable ct={crosstab} />
                    ) : (
                      <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
                        Elegí una pregunta y una variable distinta para ver el cruce.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* ------------------------------------------------- preguntas */}
              <section id="preguntas" className="scroll-mt-28 space-y-4">
                <SectionTitle
                  icon={<Target className="size-4" />}
                  title="Pregunta por pregunta"
                  description="Pasá el cursor sobre una barra para ver su intervalo de confianza al 95%."
                />
                <div className="grid items-start gap-4 xl:grid-cols-2">
                  {questions.map((q) => (
                    <QuestionCard key={q.question.id} q={q} />
                  ))}
                </div>
              </section>

              {/* ---------------------------------------------------- equipo */}
              {bySurveyor.length ? (
              <section id="equipo" className="scroll-mt-28">
                <Card>
                  <CardHeader>
                    <div>
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-[var(--muted)]" />
                        <CardTitle>Equipo y control de calidad</CardTitle>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {quality.expressThreshold
                          ? `Se marca como exprés toda entrevista de menos de ${formatDuration(quality.expressThreshold)} (40% de la mediana).`
                          : "Rendimiento por encuestador."}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <TableWrap>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <Th>Encuestador</Th>
                            <Th className="w-56">Cuota</Th>
                            <Th className="text-right">Mediana</Th>
                            <Th className="text-right">Exprés</Th>
                            <Th className="text-right">NS/NC</Th>
                            <Th className="text-right">Última carga</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {bySurveyor.map((s) => {
                            const stale = s.daysSinceLast !== null && s.daysSinceLast >= 2 && survey.status === "activa";
                            const expressShare = s.value ? (s.express / s.value) * 100 : 0;
                            return (
                              <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
                                <Td>
                                  <p className="font-medium">{s.name}</p>
                                  <p className="text-xs text-[var(--muted)]">
                                    {s.zone ?? "Sin zona asignada"}
                                    {s.discarded ? ` · ${s.discarded} descartadas` : ""}
                                  </p>
                                </Td>
                                <Td>
                                  {s.quota ? (
                                    <div className="flex items-center gap-3">
                                      <Progress value={s.value} max={s.quota} tone={s.value >= s.quota ? "success" : "primary"} className="flex-1" />
                                      <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                                        {formatNumber(s.value)}/{formatNumber(s.quota)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-[var(--muted)]">{formatNumber(s.value)} casos · sin cuota</span>
                                  )}
                                </Td>
                                <Td className="text-right tabular-nums">{formatDuration(s.medianDuration)}</Td>
                                <Td className="text-right">
                                  {s.express ? (
                                    <Badge tone={expressShare >= 5 ? "danger" : "warning"}>
                                      <AlertTriangle className="size-3" />
                                      {s.express} ({expressShare.toFixed(0)}%)
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-[var(--muted)]">0</span>
                                  )}
                                </Td>
                                <Td className="text-right text-xs tabular-nums text-[var(--muted)]">
                                  {s.noAnswerShare === null ? "—" : formatPercent(s.noAnswerShare)}
                                </Td>
                                <Td className="text-right">
                                  {s.daysSinceLast === null ? (
                                    <span className="text-xs text-[var(--muted)]">Sin cargas</span>
                                  ) : (
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 text-xs tabular-nums",
                                        stale ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]",
                                      )}
                                    >
                                      {stale ? <CalendarClock className="size-3.5" /> : <Clock className="size-3.5" />}
                                      {s.daysSinceLast === 0 ? "Hoy" : s.daysSinceLast === 1 ? "Ayer" : `Hace ${s.daysSinceLast} días`}
                                    </span>
                                  )}
                                </Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </TableWrap>
                  </CardContent>
                </Card>
              </section>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 pt-2">
      <span className="mt-0.5 flex size-8 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
        {icon}
      </span>
      <div>
        <h2 className="display text-2xl leading-tight text-[var(--foreground)]">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
    </div>
  );
}

function QuestionCard({ q }: { q: QuestionAnalytics }) {
  const { question } = q;
  const small = q.answered > 0 && q.answered < SMALL_BASE;
  const wide = q.samples.length > 0 || question.options.length > 6;
  const range =
    question.type === "escala"
      ? scaleBoxes(Math.round(question.min_value ?? 1), Math.round(question.max_value ?? 10))
      : null;

  return (
    <Card className={cn("flex flex-col", wide && "xl:col-span-2")}>
      <CardHeader>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-[var(--primary)]">P{question.position}</span>
            <Badge tone="neutral">{QUESTION_TYPE_LABEL[question.type]}</Badge>
            <Badge tone="primary">n = {formatNumber(q.answered)}</Badge>
            {small ? <Badge tone="warning">Base chica</Badge> : null}
            {q.condition ? (
              <Badge tone="accent">
                <GitBranch className="size-3" />
                Condicional
              </Badge>
            ) : null}
            {question.logic?.end_if?.length ? <Badge tone="warning">Filtro</Badge> : null}
          </div>
          <CardTitle className="mt-2 text-base leading-snug">{question.text}</CardTitle>
          {q.condition ? <p className="mt-1 text-xs text-[var(--muted)]">{q.condition}.</p> : null}
          {q.multiple ? (
            <p className="mt-1 text-xs text-[var(--muted)]">Respuesta múltiple: los porcentajes suman más de 100%.</p>
          ) : null}
        </div>
        {q.average !== null ? (
          <div className="text-right">
            <p className="text-xs text-[var(--muted)]">Promedio</p>
            <p className="display text-3xl leading-none tabular-nums text-[var(--foreground)]">
              {q.average.toFixed(question.type === "escala" ? 1 : 0).replace(".", ",")}
            </p>
            {q.stdDev !== null ? (
              <p className="mt-1 text-[11px] text-[var(--muted)]">σ {q.stdDev.toFixed(1).replace(".", ",")}</p>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex-1 pt-5">
        {q.answered === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">Sin respuestas en este recorte.</p>
        ) : q.samples.length ? (
          <div className="space-y-4">
            {q.topTerms.length ? (
              <div className="flex flex-wrap gap-1.5">
                {q.topTerms.map((t, i) => (
                  <span
                    key={t.term}
                    className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 font-medium text-[var(--primary)]"
                    style={{ fontSize: `${Math.max(11, 15 - i * 0.5)}px`, opacity: Math.max(0.55, 1 - i * 0.05) }}
                  >
                    {t.term} <span className="text-[var(--muted)]">{t.count}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {q.samples.slice(0, 9).map((s, idx) => (
                <li
                  key={idx}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-relaxed text-[var(--foreground)]"
                >
                  <span className="display mr-0.5 text-lg leading-none text-[var(--primary)]">“</span>
                  {s}
                </li>
              ))}
            </ul>
            {q.answered > 9 ? (
              <p className="text-xs text-[var(--muted)]">
                Mostrando 9 de {formatNumber(q.answered)} respuestas. La base completa está en la exportación CSV.
              </p>
            ) : null}
          </div>
        ) : question.type === "escala" && range ? (
          <div className="space-y-4">
            <ScaleColumns data={q.distribution} topFrom={range.topFrom} bottomTo={range.bottomTo} />
            {q.boxes ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--success-soft)] px-3 py-2.5">
                  <p className="text-[11px] font-medium text-[var(--success)]">Valoración alta ({q.boxes.topLabel})</p>
                  <p className="display text-2xl leading-tight tabular-nums text-[var(--success)]">{formatPercent(q.boxes.top)}</p>
                </div>
                <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2.5">
                  <p className="text-[11px] font-medium text-[var(--danger)]">Valoración baja ({q.boxes.bottomLabel})</p>
                  <p className="display text-2xl leading-tight tabular-nums text-[var(--danger)]">{formatPercent(q.boxes.bottom)}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {q.net ? <NetBar {...q.net} /> : null}
            <DistributionBars data={q.distribution} multiple={q.multiple} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
