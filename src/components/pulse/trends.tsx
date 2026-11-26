"use client";

import { Area, AreaChart, Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { signed, type DayPoint } from "@/lib/pulse";
import { SMALL_BASE, formatDayKey } from "@/lib/stats";
import { formatNumber } from "@/lib/utils";

const axis = {
  stroke: "var(--border)",
  tick: { fill: "var(--muted)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
};

function Box({ title, lines }: { title: string; lines: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-36 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg">
      <p className="text-xs text-[var(--muted)]">{title}</p>
      {lines.map((line) => (
        <p key={line.label} className="mt-1 flex items-center justify-between gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
            {line.color ? <span className="h-0.5 w-3 rounded-full" style={{ background: line.color }} /> : null}
            {line.label}
          </span>
          <span className="text-sm font-semibold text-[var(--foreground)] tabular-nums">{line.value}</span>
        </p>
      ))}
    </div>
  );
}

type TipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };

/** La fila de datos que está bajo el puntero, si hay alguna. */
const hovered = <T,>({ active, payload }: TipProps) => (active ? (payload?.[0]?.payload as T | undefined) : undefined);

/** Saldo de la gestión en el tiempo y, debajo, cuántos casos sostienen cada punto. Un eje por gráfico. */
export function BalanceTrend({ data }: { data: DayPoint[] }) {
  // Un saldo con pocos casos salta de punta a punta y aplasta el resto: no se dibuja.
  const rows = data.map((d) => ({
    ...d,
    name: formatDayKey(d.key),
    net: d.net === null || d.base < SMALL_BASE ? null : Math.round(d.net),
  }));
  const drawable = rows.some((r) => r.net !== null);
  const reach = Math.max(20, ...rows.map((r) => Math.abs(r.net ?? 0)));
  const edge = Math.min(100, Math.ceil(reach / 10) * 10);
  return (
    <div>
      {drawable ? null : (
        <p className="rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--muted)]">
          Con estos filtros no se juntan {SMALL_BASE} respuestas en ninguna semana, así que no se dibuja la evolución.
        </p>
      )}
      <ResponsiveContainer width="100%" height={drawable ? 180 : 0}>
        <AreaChart data={rows} syncId="pulso" margin={{ top: 10, right: 8, bottom: 10, left: 0 }}>
          <XAxis dataKey="name" hide />
          <YAxis {...axis} width={40} domain={[-edge, edge]} ticks={[-edge, 0, edge]} interval={0} tickFormatter={(v: number) => signed(v)} />
          <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
            content={(tip: TipProps) => {
              const p = hovered<(typeof rows)[number]>(tip);
              return p ? (
                <Box title={`${p.name} · últimos 7 días`} lines={[{ label: "Saldo", value: p.net === null ? "—" : signed(p.net), color: "var(--chart-1)" }]} />
              ) : null;
            }}
          />
          <Area type="monotone" dataKey="net" stroke="var(--chart-1)" strokeWidth={2} fill="var(--chart-1)" fillOpacity={0.1} connectNulls activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-3 text-xs font-medium text-[var(--muted)]">Casos por día</p>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={rows} syncId="pulso" margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="name" {...axis} minTickGap={28} />
          <YAxis {...axis} width={40} allowDecimals={false} tickCount={3} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={(tip: TipProps) => {
              const p = hovered<(typeof rows)[number]>(tip);
              return p ? <Box title={p.name} lines={[{ label: "Casos", value: formatNumber(p.count) }]} /> : null;
            }}
          />
          <Bar dataKey="count" fill="var(--chart-1)" fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type SocialDay = { key: string; positivo: number; neutral: number; negativo: number };

/** Conversación en redes por día, apilada por tono. */
export function SocialBars({ data }: { data: SocialDay[] }) {
  const rows = data.map((d) => ({ ...d, name: formatDayKey(d.key) }));
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {[
          ["Positivas", "var(--eval-muy-pos)"],
          ["Neutrales", "var(--eval-neutro)"],
          ["Negativas", "var(--eval-muy-neg)"],
        ].map(([label, color]) => (
          <li key={label} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: color }} />
            {label}
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="name" {...axis} minTickGap={24} />
          <YAxis {...axis} width={40} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={(tip: TipProps) => {
              const p = hovered<(typeof rows)[number]>(tip);
              return p ? (
                <Box
                  title={p.name}
                  lines={[
                    { label: "Positivas", value: formatNumber(p.positivo), color: "var(--eval-muy-pos)" },
                    { label: "Neutrales", value: formatNumber(p.neutral), color: "var(--eval-neutro)" },
                    { label: "Negativas", value: formatNumber(p.negativo), color: "var(--eval-muy-neg)" },
                  ]}
                />
              ) : null;
            }}
          />
          <Bar dataKey="positivo" stackId="s" fill="var(--eval-muy-pos)" stroke="var(--surface)" strokeWidth={1} maxBarSize={22} />
          <Bar dataKey="neutral" stackId="s" fill="var(--eval-neutro)" stroke="var(--surface)" strokeWidth={1} maxBarSize={22} />
          <Bar dataKey="negativo" stackId="s" fill="var(--eval-muy-neg)" stroke="var(--surface)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
