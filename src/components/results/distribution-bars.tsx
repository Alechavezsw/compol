import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { Distribution } from "@/lib/analytics";

/**
 * Barras horizontales en HTML (no canvas): etiquetas largas legibles, el
 * margen de error dibujado como intervalo y buen resultado al imprimir.
 */
export function DistributionBars({
  data,
  multiple = false,
  showMoe = true,
}: {
  data: Distribution[];
  multiple?: boolean;
  showMoe?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.percent + (showMoe ? (d.moe ?? 0) : 0)));
  const scale = multiple ? max : Math.max(max, 60);
  const leader = data.reduce((best, d) => (d.value > (best?.value ?? -1) ? d : best), data[0]);

  return (
    <ul className="space-y-2.5">
      {data.map((d) => {
        const width = (d.percent / scale) * 100;
        const lo = Math.max(0, d.percent - (d.moe ?? 0));
        const hi = d.percent + (d.moe ?? 0);
        const tint =
          d.exclusive || /^(no sabe|ns\/nc|otro)/i.test(d.name)
            ? "var(--muted)"
            : d.valence === 1
              ? "var(--success)"
              : d.valence === -1
                ? "var(--danger)"
                : "var(--primary)";
        const isLeader = d === leader && d.value > 0;

        return (
          <li key={d.key} className="group">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span
                className={cn(
                  "min-w-0 truncate",
                  isLeader ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground)]",
                  d.exclusive && "text-[var(--muted)]",
                )}
                title={d.name}
              >
                {d.name}
              </span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-xs text-[var(--muted)]">{formatNumber(d.value)}</span>
                <span className="w-14 text-right font-semibold text-[var(--foreground)]">
                  {formatPercent(d.percent)}
                </span>
              </span>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-full bg-[var(--surface-2)]">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                style={{
                  width: `${Math.min(100, width)}%`,
                  background: `linear-gradient(90deg, color-mix(in oklab, ${tint} 70%, transparent), ${tint})`,
                }}
              />
              {showMoe && d.moe !== null && d.value > 0 ? (
                <div
                  className="absolute top-1/2 h-4 -translate-y-1/2 border-x-2 border-[color-mix(in_oklab,var(--foreground)_45%,transparent)] opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    left: `${(lo / scale) * 100}%`,
                    width: `${Math.max(0.5, ((Math.min(hi, scale) - lo) / scale) * 100)}%`,
                  }}
                  title={`Intervalo al 95%: ${formatPercent(lo)} a ${formatPercent(hi)}`}
                >
                  <span className="absolute top-1/2 right-0 left-0 h-px bg-[color-mix(in_oklab,var(--foreground)_45%,transparent)]" />
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Columnas verticales para escalas: cada punto de la escala es una barra. */
export function ScaleColumns({
  data,
  topFrom,
  bottomTo,
}: {
  data: Distribution[];
  topFrom?: number;
  bottomTo?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.percent));
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5">
        {data.map((d) => {
          const n = Number(d.key);
          const tone =
            topFrom !== undefined && n >= topFrom
              ? "var(--success)"
              : bottomTo !== undefined && n <= bottomTo
                ? "var(--danger)"
                : "var(--primary)";
          return (
            <div key={d.key} className="group relative flex h-full flex-1 flex-col justify-end">
              <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded-md bg-[var(--foreground)] px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-[var(--background)] opacity-0 transition-opacity group-hover:opacity-100">
                {formatPercent(d.percent)} · {formatNumber(d.value)}
              </span>
              <div
                className="w-full rounded-t-lg transition-[height] duration-700"
                style={{
                  height: `${Math.max(2, (d.percent / max) * 100)}%`,
                  background: `linear-gradient(180deg, ${tone}, color-mix(in oklab, ${tone} 55%, transparent))`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((d) => (
          <span key={d.key} className="flex-1 text-center text-xs tabular-nums text-[var(--muted)]">
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barra apilada positivas / neutras / negativas con el saldo neto. */
export function NetBar({
  positive,
  negative,
  net,
}: {
  positive: number;
  negative: number;
  net: number;
}) {
  const neutral = Math.max(0, 100 - positive - negative);
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Saldo neto</p>
          <p
            className={cn(
              "display text-3xl leading-none tabular-nums",
              net >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]",
            )}
          >
            {net >= 0 ? "+" : "−"}
            {Math.abs(net).toFixed(1).replace(".", ",")}
            <span className="ml-1 text-sm font-medium">pp</span>
          </p>
        </div>
        <div className="flex gap-4 text-right text-xs">
          <div>
            <p className="text-[var(--muted)]">Positivas</p>
            <p className="font-semibold tabular-nums text-[var(--success)]">{formatPercent(positive)}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Negativas</p>
            <p className="font-semibold tabular-nums text-[var(--danger)]">{formatPercent(negative)}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
        <div style={{ width: `${positive}%` }} className="bg-[var(--success)]" />
        <div style={{ width: `${neutral}%` }} className="bg-[color-mix(in_oklab,var(--muted)_30%,transparent)]" />
        <div style={{ width: `${negative}%` }} className="bg-[var(--danger)]" />
      </div>
    </div>
  );
}
