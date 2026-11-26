"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LikertBars, type LikertRow } from "@/components/pulse/bars";
import { signed } from "@/lib/pulse";
import { cn, formatNumber } from "@/lib/utils";

/** Menos notas que esto en una fila y el tono se lee con cuidado. */
const FEW_NOTES = 5;

/**
 * Barras de tono por tema o por red. Tocar una fila la pone como filtro en la
 * dirección (`param`), y tocarla de nuevo la saca.
 */
export function ToneFilterBars({
  rows,
  param,
  selected,
}: {
  rows: LikertRow[];
  param: "tema" | "red";
  selected: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  const toggle = (key: string) => {
    const params = new URLSearchParams(search.toString());
    if (selected === key) params.delete(param);
    else params.set(param, key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <LikertBars rows={rows} selected={selected} onSelect={toggle} unit="notas" minBase={FEW_NOTES} />
    </div>
  );
}

type MoodPoint = { name: string; mood: number | null; total: number };

/** Índice de tono por día. Los días con menos de tres notas quedan sin punto. */
export function MoodLine({ data }: { data: MoodPoint[] }) {
  const reach = Math.max(20, ...data.map((d) => Math.abs(d.mood ?? 0)));
  const edge = Math.min(100, Math.ceil(reach / 10) * 10);
  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={data} margin={{ top: 10, right: 8, bottom: 6, left: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          width={40}
          domain={[-edge, edge]}
          ticks={[-edge, 0, edge]}
          interval={0}
          tickFormatter={(v: number) => signed(v)}
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.5} />
        <Tooltip
          cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as MoodPoint | undefined;
            if (!active || !point) return null;
            return (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg">
                <p className="text-xs text-[var(--muted)]">
                  {point.name} · {formatNumber(point.total)} notas
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {point.mood === null ? "Muy pocas para medir el tono" : `Tono ${signed(point.mood)}`}
                </p>
              </div>
            );
          }}
        />
        <Line type="monotone" dataKey="mood" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--surface)", strokeWidth: 2 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
