export function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[540px] lg:mx-0">
      <div className="orb top-[-40px] right-[-20px] size-44 bg-[var(--primary)] opacity-30 animate-float" />
      <div
        className="orb bottom-[-30px] left-[-30px] size-40 bg-[var(--accent)] opacity-25 animate-float"
        style={{ animationDelay: "1.4s" }}
      />

      <div className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_30px_80px_-32px_rgba(40,20,90,.45)] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
              En vivo
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
              Clima social · San Juan
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--success)]">
            <span className="size-1.5 rounded-full bg-current animate-pulse-soft" />
            Campo abierto
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            ["1.284", "casos"],
            ["64%", "cuota"],
            ["18", "en campo"],
          ].map(([n, l]) => (
            <div
              key={l}
              className="rounded-2xl bg-[var(--surface-2)] px-3 py-3"
            >
              <p className="display text-2xl leading-none text-[var(--foreground)]">{n}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">{l}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-3.5">
          <div className="mb-3 flex items-end justify-between">
            <p className="text-xs font-medium text-[var(--muted)]">Ritmo diario</p>
            <p className="text-[11px] font-semibold text-[var(--primary)]">+12% vs. ayer</p>
          </div>
          <div className="flex h-24 items-end gap-1.5">
            {[38, 52, 44, 61, 70, 58, 82, 76, 90, 68, 95, 88].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md"
                style={{
                  height: `${h}%`,
                  background:
                    i === 11
                      ? "linear-gradient(180deg, var(--primary), var(--accent))"
                      : "color-mix(in oklab, var(--primary) 55%, var(--surface))",
                  opacity: 0.45 + i * 0.045,
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {[
            ["Prioridad: seguridad", "41%"],
            ["Prioridad: salud", "27%"],
            ["Prioridad: empleo", "18%"],
          ].map(([label, pct], i) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-[12px] text-[var(--muted)]">
                {label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: pct,
                    background:
                      i === 0
                        ? "var(--primary)"
                        : i === 1
                          ? "var(--accent)"
                          : "color-mix(in oklab, var(--primary) 55%, var(--accent))",
                  }}
                />
              </div>
              <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-[var(--foreground)]">
                {pct}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
