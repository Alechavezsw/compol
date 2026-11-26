"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Pause, Play, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LikertBars, RankBars, ScaleBars, ToneLegend, type LikertRow } from "@/components/pulse/bars";
import { MapLegend } from "@/components/pulse/map-legend";
import { MAP_TONE, averageRange, decimal, paintZones, type MapMetric, type MapSummary } from "@/components/pulse/map-paint";
import { CountUp } from "@/components/pulse/motion";
import { Segmented } from "@/components/pulse/segmented";
import { BalanceTrend, SocialBars, type SocialDay } from "@/components/pulse/trends";
import { ZoneMap, type MapDot } from "@/components/pulse/zone-map";
import {
  average,
  balance,
  dailySeries,
  distribution,
  filterCases,
  signed,
  weeklyChange,
  zoneCenters,
  zoneSummaries,
  type PulseData,
  type PulseFilter,
} from "@/lib/pulse";
import { SMALL_BASE, formatDayKey, maxMarginOfError } from "@/lib/stats";
import { cn, formatNumber } from "@/lib/utils";

const STEP_MS = 450;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none active:scale-[0.98]",
        active
          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-fg)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)]",
      )}
    >
      {children}
    </button>
  );
}

function Kpi({ label, children, hint }: { label: string; children: React.ReactNode; hint: React.ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <div className="mt-2 text-4xl font-semibold tracking-tight text-[var(--foreground)]">{children}</div>
      <div className="mt-2 text-xs text-[var(--muted)]">{hint}</div>
    </Card>
  );
}

export function PulseBoard({ data, social, target }: { data: PulseData; social: SocialDay[]; target: number }) {
  const { evaluation, agenda, scale, profile, others } = data.roles;
  const lastDay = data.days.length - 1;

  const [zone, setZone] = useState<number | null>(null);
  const [segments, setSegments] = useState<Record<number, number>>({});
  // `null` es "hasta hoy": así el tablero sigue al día si la página se refresca.
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [metric, setMetric] = useState<MapMetric>(evaluation !== null ? "saldo" : scale !== null ? "promedio" : "casos");
  const [view, setView] = useState<"zonas" | "casos">("zonas");
  const day = cursor ?? lastDay;

  // La línea de tiempo avanza un día por vez hasta llegar al final.
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      if (day >= lastDay) {
        setPlaying(false);
        setCursor(null);
      } else setCursor(day + 1);
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, day, lastDay]);

  const centers = useMemo(() => zoneCenters(data), [data]);
  const board = useMemo(() => {
    const filter: PulseFilter = { zone, segments, day: cursor };
    const scoped = filterCases(data.cases, filter);
    const zones = zoneSummaries(data, filterCases(data.cases, { ...filter, zone: null }));
    const history = filterCases(data.cases, { ...filter, day: null });
    return { scoped, zones, history };
  }, [data, zone, segments, cursor]);
  const { scoped, zones, history } = board;

  const evalQuestion = evaluation === null ? null : data.questions[evaluation];
  const overall = evaluation === null ? null : balance(scoped, evaluation, data.questions[evaluation]);
  const change = weeklyChange(data, history, day, SMALL_BASE);
  const scaleQuestion = scale === null ? null : data.questions[scale];
  const scaleAverage = scale === null ? null : average(scoped, scale);
  const agendaShares = agenda === null ? null : distribution(scoped, agenda, data.questions[agenda]);
  const topIssue = agendaShares?.base ? [...agendaShares.shares].sort((a, b) => b.percent - a.percent)[0] : null;
  const series = useMemo(() => dailySeries(data, history, day), [data, history, day]);
  const moe = maxMarginOfError(scoped.length);

  const filtered = zone !== null || Object.keys(segments).length > 0 || cursor !== null;
  const reset = () => {
    setZone(null);
    setSegments({});
    setCursor(null);
    setPlaying(false);
  };
  const toggleZone = (index: number) => setZone((current) => (current === index ? null : index));
  const setSegment = (question: number, option: number | null) =>
    setSegments((current) => {
      const next = { ...current };
      if (option === null || next[question] === option) delete next[question];
      else next[question] = option;
      return next;
    });

  // --- mapa ------------------------------------------------------------------
  const summaries: MapSummary[] = zones.map((z) => ({ index: z.index, name: z.name, count: z.count, net: z.balance?.net ?? null, average: z.average }));
  const { low, high } = averageRange(summaries);
  const mapZones = paintZones(summaries, centers, metric);
  const hasPoints = data.cases.some((c) => c.p);
  // Sin zonas ubicables (por ejemplo, respuestas sin GPS) solo se pueden dibujar casos sueltos.
  const canDrawZones = mapZones.length > 0;
  const shown = canDrawZones ? view : "casos";
  const dots: MapDot[] | null =
    shown === "casos"
      ? scoped.flatMap((c, id) => {
          if (!c.p) return [];
          const answer = evaluation === null ? null : c.v[evaluation];
          const tone = typeof answer === "number" ? evalQuestion?.options[answer]?.tone : undefined;
          return [{ id, point: c.p, color: evaluation === null ? "#b3a8ff" : MAP_TONE[tone ?? "sin_dato"] }];
        })
      : null;

  // --- lectura rápida por zona ----------------------------------------------
  const comparable = zones.filter((z) => z.balance && z.balance.base >= SMALL_BASE).sort((a, b) => b.balance!.net - a.balance!.net);
  const best = comparable[0];
  const worst = comparable.length > 1 ? comparable[comparable.length - 1] : null;

  const zoneRows: LikertRow[] =
    evaluation === null
      ? []
      : zones.map((z) => {
          const inZone = filterCases(data.cases, { zone: z.index, segments, day: cursor });
          const { shares, base } = distribution(inZone, evaluation, data.questions[evaluation]);
          return { key: String(z.index), label: z.name, shares, base, net: z.balance?.net ?? null };
        });

  const zoned = zones.reduce((sum, z) => sum + z.count, 0);
  const zoneShares = zones.map((z) => ({
    index: z.index,
    label: z.name,
    tone: "sin_dato" as const,
    count: z.count,
    percent: zoned ? (z.count / zoned) * 100 : 0,
  }));
  const hasAside = Boolean(evalQuestion || agendaShares || data.zones.length);

  const metricOptions = [
    ...(evaluation !== null ? [{ value: "saldo" as const, label: "Saldo" }] : []),
    ...(scale !== null ? [{ value: "promedio" as const, label: "Promedio" }] : []),
    { value: "casos" as const, label: "Casos" },
  ];

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------- filtros */}
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div
          className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0", !data.zones.length && "hidden")}
          role="group"
          aria-label="Zona"
        >
          <Chip active={zone === null} onClick={() => setZone(null)}>
            Todas las zonas
          </Chip>
          {data.zones.map((name, index) => (
            <Chip key={name} active={zone === index} onClick={() => toggleZone(index)}>
              {name}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile.map((q) => (
            <label key={data.questions[q].id} className="text-sm text-[var(--muted)]">
              <span className="sr-only">{data.questions[q].label}</span>
              <select
                value={segments[q] ?? ""}
                onChange={(e) => setSegment(q, e.target.value === "" ? null : Number(e.target.value))}
                className="h-9 max-w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
              >
                <option value="">{data.questions[q].label}: todo</option>
                {data.questions[q].options.map((option, i) => (
                  <option key={option.label} value={i}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {/* Ocupa su lugar aunque no haya filtros, para que los chips no salten al elegir uno. */}
          <button
            type="button"
            onClick={reset}
            disabled={!filtered}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none active:translate-y-px",
              !filtered && "invisible",
            )}
          >
            <RotateCcw className="size-4" />
            Limpiar
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ cifras */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))] gap-4">
        {overall ? (
          <Kpi
            label="Saldo de la gestión"
            hint={
              <>
                <span className="block">
                  {Math.round(overall.positive)}% a favor · {Math.round(overall.negative)}% en contra
                </span>
                {change !== null && Math.round(change) !== 0 ? (
                  <span className="mt-1 inline-flex items-center gap-1 font-semibold text-[var(--foreground)]">
                    {change > 0 ? (
                      <ArrowUpRight className="size-4 text-[var(--eval-pos)]" />
                    ) : (
                      <ArrowDownRight className="size-4 text-[var(--eval-neg)]" />
                    )}
                    {signed(change)} puntos en la última semana
                  </span>
                ) : null}
              </>
            }
          >
            <CountUp value={overall.net} format={signed} />
          </Kpi>
        ) : null}
        {scaleQuestion ? (
          <Kpi label={scaleQuestion.label} hint={`Promedio de ${formatNumber(scaleAverage?.base ?? 0)} respuestas`}>
            {scaleAverage ? <CountUp value={scaleAverage.value} format={decimal} /> : "—"}
            <span className="ml-1 text-lg font-medium text-[var(--muted)]">de {scaleQuestion.max}</span>
          </Kpi>
        ) : null}
        {agendaShares ? (
          <Kpi label="Lo que más preocupa" hint={topIssue ? `Lo menciona el ${Math.round(topIssue.percent)}%` : "Sin respuestas"}>
            <span className="block truncate text-2xl leading-10" title={topIssue?.label}>
              {topIssue?.label ?? "—"}
            </span>
          </Kpi>
        ) : null}
        <Kpi
          label="Casos analizados"
          hint={
            <>
              <span className="block">
                {filtered ? `De ${formatNumber(data.cases.length)} en total` : target ? `Meta: ${formatNumber(target)}` : "Todo el operativo"}
                {moe ? ` · margen ±${decimal(moe)} pts` : ""}
              </span>
              {target && !filtered ? (
                <span className="mt-2 block h-1.5 rounded-full bg-[var(--surface-2)]">
                  <span
                    className="block h-full rounded-full bg-[var(--chart-1)] transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                    style={{ width: `${Math.min(100, (data.cases.length / target) * 100)}%` }}
                  />
                </span>
              ) : null}
            </>
          }
        >
          <CountUp value={scoped.length} format={(n) => formatNumber(Math.round(n))} />
        </Kpi>
      </div>

      {!scoped.length ? (
        <p role="status" className="rounded-xl bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
          No hay casos con estos filtros. Tocá «Limpiar» para volver al total.
        </p>
      ) : null}

      {/* ------------------------------------------------------------- mapa */}
      <div className="grid items-start gap-4 xl:grid-cols-5">
        <Card className={hasAside ? "xl:col-span-3" : "xl:col-span-5"}>
          <CardHeader>
            <div>
              <CardTitle>Mapa del territorio</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {best && worst
                  ? `Mejor saldo en ${best.name} (${signed(best.balance!.net)}), más crítico en ${worst.name} (${signed(worst.balance!.net)}).`
                  : canDrawZones
                    ? "Tocá una zona para ver todo el tablero de ese lugar."
                    : "Cada punto es un caso con ubicación."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {shown === "zonas" && metricOptions.length > 1 ? (
                <Segmented label="Qué muestra el mapa" value={metric} options={metricOptions} onChange={setMetric} />
              ) : null}
              {canDrawZones ? (
                <Segmented
                  label="Cómo se dibuja"
                  value={view}
                  options={[
                    { value: "zonas", label: "Zonas" },
                    { value: "casos", label: "Casos" },
                  ]}
                  onChange={setView}
                />
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {hasPoints ? (
              <div className="relative isolate overflow-hidden rounded-2xl bg-[#070b14]">
                <ZoneMap zones={mapZones} dots={dots} selected={zone} onSelect={toggleZone} />
                {shown === "casos" ? (
                  <div className="pointer-events-none absolute bottom-6 left-3 z-[1000] rounded-xl border border-white/10 bg-[#0b1220]/90 px-3 py-2 text-xs text-slate-300">
                    {evalQuestion ? (
                      <ul className="flex flex-wrap gap-x-3 gap-y-1">
                        {evalQuestion.options.map((o) => (
                          <li key={o.label} className="inline-flex items-center gap-1.5">
                            <span className="size-2 rounded-full" style={{ background: MAP_TONE[o.tone] }} />
                            {o.label}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "Cada punto es un caso"
                    )}
                  </div>
                ) : (
                  <MapLegend metric={metric} low={low} high={high} />
                )}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--muted)]">
                Las respuestas de esta encuesta no tienen ubicación, así que no hay mapa. En las entrevistas de campo aparece cuando el teléfono comparte el GPS.
              </p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (playing) return setPlaying(false);
                  if (day >= lastDay) setCursor(0);
                  setPlaying(true);
                }}
                disabled={lastDay < 1}
                aria-label={playing ? "Pausar" : "Reproducir día por día"}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-fg)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96] disabled:opacity-50"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={lastDay}
                value={day}
                onChange={(e) => {
                  setPlaying(false);
                  const next = Number(e.target.value);
                  setCursor(next >= lastDay ? null : next);
                }}
                aria-label="Hasta qué día"
                aria-valuetext={formatDayKey(data.days[day])}
                className="h-2 w-full cursor-pointer accent-[var(--primary)]"
              />
              <span className="w-28 shrink-0 text-right text-sm text-[var(--muted)] tabular-nums">
                {cursor === null ? "Hasta hoy" : `Al ${formatDayKey(data.days[day])}`}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className={cn("space-y-4 xl:col-span-2", !hasAside && "hidden")}>
          {!evalQuestion && data.zones.length ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Respuestas por zona</CardTitle>
                  <p className="mt-1 text-sm text-[var(--muted)]">Qué parte de los casos aporta cada lugar.</p>
                </div>
              </CardHeader>
              <CardContent>
                <RankBars shares={zoneShares} />
              </CardContent>
            </Card>
          ) : null}
          {evalQuestion ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>La gestión zona por zona</CardTitle>
                  <p className="mt-1 text-sm text-[var(--muted)]">Ordenadas por saldo. {evalQuestion.text}</p>
                </div>
              </CardHeader>
              <CardContent>
                <ToneLegend shares={distribution([], evaluation!, evalQuestion).shares} />
                <div className="mt-4">
                  <LikertBars rows={zoneRows} sortByNet selected={zone === null ? null : String(zone)} onSelect={(key) => toggleZone(Number(key))} />
                </div>
              </CardContent>
            </Card>
          ) : null}
          {agendaShares && agenda !== null ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Qué preocupa</CardTitle>
                  <p className="mt-1 text-sm text-[var(--muted)]">{data.questions[agenda].text}</p>
                </div>
              </CardHeader>
              <CardContent>
                <RankBars shares={agendaShares.shares} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* ---------------------------------------------------------- perfiles */}
      {evaluation !== null && evalQuestion && profile.length ? (
        <Card className="animate-rise [animation-delay:120ms]">
          <CardHeader>
            <div>
              <CardTitle>Quién apoya y quién no</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">Tocá un grupo para ver el tablero solo con esas personas.</p>
            </div>
          </CardHeader>
          <CardContent className="grid items-start gap-6 lg:grid-cols-2">
            {profile.map((q) => {
              const rest = { ...segments };
              delete rest[q];
              const base = filterCases(data.cases, { zone, segments: rest, day: cursor });
              const rows: LikertRow[] = data.questions[q].options.flatMap((option, i) => {
                const group = base.filter((c) => c.v[q] === i);
                if (!group.length) return [];
                const { shares, base: answered } = distribution(group, evaluation, evalQuestion);
                return [{ key: String(i), label: option.label, shares, base: answered, net: balance(group, evaluation, evalQuestion)?.net ?? null }];
              });
              return (
                <div key={data.questions[q].id}>
                  <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{data.questions[q].label}</p>
                  <LikertBars rows={rows} selected={segments[q] === undefined ? null : String(segments[q])} onSelect={(key) => setSegment(q, Number(key))} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------------------------------------- en el tiempo */}
      <div className="animate-rise grid items-start gap-4 [animation-delay:180ms] xl:grid-cols-5">
        {evaluation !== null ? (
          <Card className="xl:col-span-3">
            <CardHeader>
              <div>
                <CardTitle>Cómo viene la evaluación</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Saldo de los últimos 7 días, calculado en cada fecha.</p>
              </div>
            </CardHeader>
            <CardContent>
              <BalanceTrend data={series} />
            </CardContent>
          </Card>
        ) : null}
        {scaleQuestion && scale !== null ? (
          <Card className={evaluation !== null ? "xl:col-span-2" : "xl:col-span-5"}>
            <CardHeader>
              <div>
                <CardTitle>{scaleQuestion.label}</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">{scaleQuestion.text}</p>
              </div>
            </CardHeader>
            <CardContent>
              <ScaleBars
                counts={Array.from({ length: scaleQuestion.max - scaleQuestion.min + 1 }, (_, i) => {
                  const value = scaleQuestion.min + i;
                  const count = scoped.filter((c) => c.v[scale] === value).length;
                  return { value, count, percent: scaleAverage ? (count / scaleAverage.base) * 100 : 0 };
                })}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="animate-rise grid items-start gap-4 [animation-delay:240ms] md:grid-cols-2 xl:grid-cols-3">
        {others.map((q) => {
          const { shares, base } = distribution(scoped, q, data.questions[q]);
          return (
            <Card key={data.questions[q].id}>
              <CardHeader>
                <div>
                  <CardTitle>{data.questions[q].text}</CardTitle>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {formatNumber(base)} respuestas{base > 0 && base < SMALL_BASE ? " · base chica" : ""}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <RankBars shares={shares} />
              </CardContent>
            </Card>
          );
        })}
        {social.some((d) => d.positivo + d.neutral + d.negativo > 0) ? (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Conversación en redes</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Últimos 14 días, sin repetir notas. No depende de los filtros de la encuesta.</p>
              </div>
            </CardHeader>
            <CardContent>
              <SocialBars data={social} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
