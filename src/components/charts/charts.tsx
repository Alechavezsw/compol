"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, formatNumber } from "@/lib/utils";

export type Datum = { name: string; value: number; percent?: number };

const axis = {
  stroke: "var(--border)",
  tick: { fill: "var(--muted)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
};

function TooltipBox({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; name?: string; payload?: Datum }>;
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const datum = item.payload;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-[var(--foreground)]">{datum?.name ?? label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--primary)] tabular-nums">
        {formatNumber(Number(item.value))}
        {suffix ? ` ${suffix}` : ""}
        {datum?.percent !== undefined ? (
          <span className="ml-1.5 text-xs font-normal text-[var(--muted)]">
            ({datum.percent.toFixed(1)}%)
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** Barras horizontales: ideal para opciones con etiquetas largas. */
export function HorizontalBars({ data, height }: { data: Datum[]; height?: number }) {
  const h = height ?? Math.max(160, data.length * 40 + 24);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
        <XAxis type="number" {...axis} />
        <YAxis type="category" dataKey="name" width={150} {...axis} interval={0} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<TooltipBox />} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Columnas: para escalas 1..10 y distribuciones ordenadas. */
export function Columns({ data, height = 240 }: { data: Datum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -14 }}>
        <XAxis dataKey="name" {...axis} interval={0} />
        <YAxis {...axis} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<TooltipBox />} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={44} fill="var(--chart-1)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 260 }: { data: Datum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="56%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--surface)"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<TooltipBox />} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span className="text-xs text-[var(--muted)]">{String(value)}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

type FieldPoint = { name: string; value: number; cumulative: number };

function FieldTooltip({
  active,
  payload,
  target,
}: {
  active?: boolean;
  payload?: Array<{ payload?: FieldPoint }>;
  target?: number;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-[var(--foreground)]">{p.name}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--primary)]">
        {formatNumber(p.value)} <span className="text-xs font-normal text-[var(--muted)]">en el día</span>
      </p>
      <p className="text-sm font-semibold tabular-nums text-[var(--accent)]">
        {formatNumber(p.cumulative)}{" "}
        <span className="text-xs font-normal text-[var(--muted)]">
          acumulados{target ? ` · ${Math.round((p.cumulative / target) * 100)}% de la meta` : ""}
        </span>
      </p>
    </div>
  );
}

/**
 * Campo día por día (barras) con el acumulado contra la meta (línea). Dos ejes
 * porque las magnitudes no se parecen: 20 casos en un día vs 400 acumulados.
 */
export function FieldTrend({
  data,
  target,
  height = 260,
}: {
  data: FieldPoint[];
  target?: number;
  height?: number;
}) {
  const maxCumulative = Math.max(target ?? 0, ...data.map((d) => d.cumulative));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 4, bottom: 4, left: -14 }}>
        <defs>
          <linearGradient id="fieldBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id="fieldArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" {...axis} minTickGap={18} />
        <YAxis yAxisId="day" {...axis} width={40} allowDecimals={false} />
        <YAxis
          yAxisId="cum"
          orientation="right"
          {...axis}
          width={44}
          domain={[0, Math.ceil(maxCumulative * 1.05)]}
          allowDecimals={false}
        />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<FieldTooltip target={target} />} />
        <Area
          yAxisId="cum"
          type="monotone"
          dataKey="cumulative"
          stroke="none"
          fill="url(#fieldArea)"
          isAnimationActive={false}
        />
        <Bar yAxisId="day" dataKey="value" fill="url(#fieldBar)" radius={[6, 6, 0, 0]} maxBarSize={22} />
        <Line
          yAxisId="cum"
          type="monotone"
          dataKey="cumulative"
          stroke="var(--chart-2)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
        {target ? (
          <ReferenceLine
            yAxisId="cum"
            y={target}
            stroke="var(--chart-3)"
            strokeDasharray="5 5"
            label={{ value: `Meta ${formatNumber(target)}`, position: "insideTopRight", fill: "var(--chart-3)", fontSize: 11 }}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

type MoodPoint = { name: string; positivo: number; neutral: number; negativo: number; mood: number | null };

function MoodTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: MoodPoint }> }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const total = p.positivo + p.neutral + p.negativo;
  return (
    <div className="min-w-40 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-[var(--foreground)]">
        {p.name} · {formatNumber(total)} publicaciones
      </p>
      <div className="mt-1.5 space-y-0.5 text-xs tabular-nums">
        <p className="flex justify-between gap-4 text-[var(--success)]">
          <span>Positivas</span> <span>{p.positivo}</span>
        </p>
        <p className="flex justify-between gap-4 text-[var(--muted)]">
          <span>Neutrales</span> <span>{p.neutral}</span>
        </p>
        <p className="flex justify-between gap-4 text-[var(--danger)]">
          <span>Negativas</span> <span>{p.negativo}</span>
        </p>
      </div>
      {p.mood !== null ? (
        <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-xs font-semibold text-[var(--foreground)]">
          Índice de humor {p.mood > 0 ? "+" : ""}
          {p.mood}
        </p>
      ) : null}
    </div>
  );
}

/** Volumen diario apilado por sentimiento, con el índice de humor como línea. */
export function MoodTrend({ data, height = 280 }: { data: MoodPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 4, bottom: 4, left: -14 }}>
        <XAxis dataKey="name" {...axis} minTickGap={18} />
        <YAxis yAxisId="vol" {...axis} width={40} allowDecimals={false} />
        <YAxis yAxisId="mood" orientation="right" {...axis} width={40} domain={[-100, 100]} ticks={[-100, -50, 0, 50, 100]} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<MoodTooltip />} />
        <ReferenceLine yAxisId="mood" y={0} stroke="var(--border)" />
        <Bar yAxisId="vol" dataKey="negativo" stackId="s" fill="var(--danger)" fillOpacity={0.85} maxBarSize={22} />
        <Bar yAxisId="vol" dataKey="neutral" stackId="s" fill="var(--muted)" fillOpacity={0.3} maxBarSize={22} />
        <Bar yAxisId="vol" dataKey="positivo" stackId="s" fill="var(--success)" fillOpacity={0.85} radius={[5, 5, 0, 0]} maxBarSize={22} />
        <Line yAxisId="mood" type="monotone" dataKey="mood" stroke="var(--primary)" strokeWidth={2.5} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Evolución diaria de la recolección en campo. */
export function TrendArea({
  data,
  height = 220,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" {...axis} minTickGap={22} />
        <YAxis {...axis} width={44} />
        <Tooltip content={<TooltipBox suffix="casos" />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
