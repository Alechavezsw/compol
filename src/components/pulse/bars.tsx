"use client";

import { TONE_COLOR } from "@/components/pulse/tone-color";
import { TONE_ORDER, signed, type EvalTone, type Share } from "@/lib/pulse";
import { SMALL_BASE } from "@/lib/stats";
import { cn, formatNumber } from "@/lib/utils";

const EASE = "duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]";
const pct = (value: number) => `${Math.round(value)}%`;

export function ToneLegend({ shares }: { shares: Share[] }) {
  const items = [...shares].filter((s) => s.tone !== "sin_dato").sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone));
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
      {items.map((item) => (
        <li key={item.index} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: TONE_COLOR[item.tone] }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export type LikertRow = { key: string; label: string; shares: Share[]; net: number | null; base: number };

const ROW = 48;

/**
 * Barras divergentes: cada fila se alinea por el centro de lo "regular", así se
 * ve de un vistazo hacia qué lado se inclina. Las filas se reordenan solas.
 */
export function LikertBars({
  rows,
  selected,
  onSelect,
  sortByNet = false,
  unit = "casos",
  minBase = SMALL_BASE,
}: {
  rows: LikertRow[];
  selected?: string | null;
  onSelect?: (key: string) => void;
  sortByNet?: boolean;
  /** Qué se cuenta en cada fila: "casos", "notas". */
  unit?: string;
  /** Por debajo de esta cantidad la fila se marca como base chica. */
  minBase?: number;
}) {
  const sides = rows.map((row) => {
    const sum = (tones: EvalTone[]) => row.shares.filter((s) => tones.includes(s.tone)).reduce((t, s) => t + s.percent, 0);
    const middle = sum(["neutro"]);
    return { left: sum(["muy_neg", "neg"]) + middle / 2, right: sum(["pos", "muy_pos"]) + middle / 2 };
  });
  const maxLeft = Math.max(1, ...sides.map((s) => s.left));
  const maxRight = Math.max(1, ...sides.map((s) => s.right));
  const span = maxLeft + maxRight;

  const order = rows
    .map((row, i) => i)
    .sort((a, b) => (sortByNet ? (rows[b].net ?? -999) - (rows[a].net ?? -999) : a - b));
  const rank = new Map(order.map((rowIndex, position) => [rowIndex, position]));

  return (
    <ul className="relative" style={{ height: rows.length * ROW }}>
      {rows.map((row, i) => {
        const segments = [...row.shares]
          .filter((s) => s.tone !== "sin_dato" && s.percent > 0)
          .sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone));
        const detail = row.shares.map((s) => `${s.label}: ${pct(s.percent)}`).join(" · ");
        const dimmed = selected != null && selected !== row.key;
        const Tag = onSelect ? "button" : "div";
        return (
          <li
            key={row.key}
            className={cn("absolute inset-x-0 transition-[top,opacity]", EASE, dimmed && "opacity-45")}
            style={{ top: (rank.get(i) ?? i) * ROW, height: ROW }}
          >
            <Tag
              {...(onSelect
                ? { type: "button" as const, onClick: () => onSelect(row.key), "aria-pressed": selected === row.key }
                : { tabIndex: 0 })}
              aria-label={`${row.label}: saldo ${row.net === null ? "sin dato" : signed(row.net)}. ${detail}. Base ${row.base} ${unit}.`}
              className={cn(
                "group relative grid h-full w-full grid-cols-[6rem_1fr_2.5rem] items-center gap-2 sm:grid-cols-[minmax(6.5rem,9rem)_1fr_3rem] sm:gap-3 rounded-xl px-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                onSelect && "cursor-pointer hover:bg-[var(--surface-2)] active:translate-y-px",
                selected === row.key && "bg-[var(--surface-2)]",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[var(--foreground)]">{row.label}</span>
                <span className="block text-xs text-[var(--muted)] tabular-nums">
                  {formatNumber(row.base)} {row.base === 1 ? unit.replace(/s$/, "") : unit}
                  {row.base > 0 && row.base < minBase ? " · base chica" : ""}
                </span>
              </span>
              <span className="relative block h-5">
                <span
                  className={cn("absolute inset-y-0 flex transition-[left,width,opacity]", EASE, row.base < minBase && "opacity-60")}
                  style={{
                    left: `${((maxLeft - sides[i].left) / span) * 100}%`,
                    width: `${((sides[i].left + sides[i].right) / span) * 100}%`,
                  }}
                >
                  {segments.map((s, position) => (
                    <span
                      key={s.index}
                      className={cn(
                        "h-full border-[var(--surface)] transition-[flex-grow]",
                        EASE,
                        position === 0 && "rounded-l-[4px]",
                        position === segments.length - 1 ? "rounded-r-[4px]" : "border-r-2",
                      )}
                      style={{ background: TONE_COLOR[s.tone], flexGrow: s.percent, flexBasis: 0 }}
                    />
                  ))}
                </span>
                <span
                  aria-hidden
                  className="absolute -inset-y-1 w-px bg-[var(--foreground)] opacity-30"
                  style={{ left: `${(maxLeft / span) * 100}%` }}
                />
              </span>
              <span
                className={cn(
                  "text-right text-sm font-semibold tabular-nums",
                  row.base < minBase ? "text-[var(--muted)]" : "text-[var(--foreground)]",
                )}
              >
                {row.net === null ? "—" : signed(row.net)}
              </span>

              <span
                role="presentation"
                className="pointer-events-none absolute bottom-full left-28 z-20 mb-1 hidden min-w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg group-hover:block group-focus-visible:block"
              >
                <span className="block text-xs font-semibold text-[var(--foreground)]">{row.label}</span>
                {row.shares.map((s) => (
                  <span key={s.index} className="mt-1 flex items-center justify-between gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
                      <span className="size-2 rounded-sm" style={{ background: TONE_COLOR[s.tone] }} />
                      {s.label}
                    </span>
                    <span className="font-semibold text-[var(--foreground)] tabular-nums">{pct(s.percent)}</span>
                  </span>
                ))}
              </span>
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}

const RANK_ROW = 44;

/** Ranking en un solo color: al filtrar, las barras cambian de largo y de lugar. */
export function RankBars({ shares }: { shares: Share[] }) {
  const order = [...shares].sort((a, b) => b.percent - a.percent || a.index - b.index);
  const rank = new Map(order.map((s, position) => [s.index, position]));
  const max = Math.max(1, ...shares.map((s) => s.percent));
  return (
    <ul className="relative" style={{ height: shares.length * RANK_ROW }}>
      {shares.map((s) => {
        const position = rank.get(s.index) ?? 0;
        return (
          <li
            key={s.index}
            className={cn("absolute inset-x-0 transition-[top]", EASE)}
            style={{ top: position * RANK_ROW, height: RANK_ROW }}
            title={`${s.label}: ${formatNumber(s.count)} personas`}
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={cn("truncate text-[var(--foreground)]", position === 0 && "font-semibold")}>{s.label}</span>
              <span className="font-semibold text-[var(--foreground)] tabular-nums">{pct(s.percent)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-[var(--surface-2)]">
              <div
                className={cn("h-full rounded-full bg-[var(--chart-1)] transition-[width,opacity]", EASE, position > 2 && "opacity-55")}
                style={{ width: `${(s.percent / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Columnas de una escala (1 a 10): cuántas personas eligieron cada valor. */
export function ScaleBars({ counts }: { counts: { value: number; count: number; percent: number }[] }) {
  const max = Math.max(1, ...counts.map((c) => c.percent));
  return (
    <ol className="flex h-44 items-end gap-1.5">
      {counts.map((c) => (
        <li key={c.value} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="pointer-events-none absolute top-0 hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold whitespace-nowrap text-[var(--foreground)] shadow-lg group-hover:block">
            {formatNumber(c.count)} · {pct(c.percent)}
          </span>
          <span
            className={cn("w-full max-w-6 rounded-t-[4px] bg-[var(--chart-1)] transition-[height]", EASE)}
            style={{ height: `${(c.percent / max) * 75}%` }}
            aria-label={`Valor ${c.value}: ${formatNumber(c.count)} personas, ${pct(c.percent)}`}
            role="img"
          />
          <span className="text-xs text-[var(--muted)] tabular-nums">{c.value}</span>
        </li>
      ))}
    </ol>
  );
}
