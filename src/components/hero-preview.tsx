"use client";

import { useEffect, useState } from "react";

const BARS = [38, 52, 44, 61, 70, 58, 82, 76, 90, 68, 95, 88];
const ZONES = ["Capital", "Rawson", "Santa Lucía", "Rivadavia", "Chimbas", "Pocito"];
const SURVEYORS = ["M. Torres", "L. Gómez", "A. Ruiz", "C. Ibáñez", "N. Ovando"];
const PRIORITIES = [
  { label: "Prioridad: seguridad", pct: 41, color: "var(--primary)" },
  { label: "Prioridad: salud", pct: 27, color: "var(--accent)" },
  { label: "Prioridad: empleo", pct: 18, color: "color-mix(in oklab, var(--primary) 55%, var(--accent))" },
];

type Hit = { id: number; zone: string; who: string; ago: number };

function seedHits(): Hit[] {
  return [
    { id: 1, zone: "Capital", who: "M. Torres", ago: 6 },
    { id: 2, zone: "Rivadavia", who: "L. Gómez", ago: 18 },
    { id: 3, zone: "Santa Lucía", who: "A. Ruiz", ago: 41 },
  ];
}

function agoLabel(seconds: number) {
  if (seconds < 8) return "ahora";
  if (seconds < 60) return `hace ${seconds}s`;
  return `hace ${Math.floor(seconds / 60)} min`;
}

export function HeroPreview() {
  const [cases, setCases] = useState(1284);
  const [field, setField] = useState(18);
  const [hits, setHits] = useState<Hit[]>(seedHits);
  const [liveBars, setLiveBars] = useState(BARS);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setHits((prev) => {
        const aged = prev.map((h) => ({ ...h, ago: h.ago + 3 })).slice(0, 3);
        if (Math.random() > 0.42) return aged;
        const next: Hit = {
          id: Date.now(),
          zone: ZONES[Math.floor(Math.random() * ZONES.length)],
          who: SURVEYORS[Math.floor(Math.random() * SURVEYORS.length)],
          ago: 2,
        };
        setCases((n) => n + 1);
        setField((n) => Math.min(21, Math.max(16, n + (Math.random() > 0.5 ? 1 : -1))));
        setLiveBars((bars) => {
          const copy = [...bars];
          const i = copy.length - 1;
          copy[i] = Math.min(100, copy[i] + 1 + Math.floor(Math.random() * 3));
          return copy;
        });
        return [next, ...aged].slice(0, 3);
      });
    }, 2800);
    return () => window.clearInterval(tick);
  }, []);

  const quota = Math.min(99, Math.round((cases / 2000) * 100));

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
              Evaluación municipal · San Juan
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--success)]">
            <span className="size-1.5 rounded-full bg-current animate-pulse-soft" />
            Campo abierto
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            [cases.toLocaleString("es-AR"), "casos"],
            [`${quota}%`, "cuota"],
            [String(field), "en campo"],
          ].map(([n, l]) => (
            <div key={l} className="rounded-2xl bg-[var(--surface-2)] px-3 py-3">
              <p className="display text-2xl leading-none text-[var(--foreground)] tabular-nums">{n}</p>
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
            {liveBars.map((h, i) => (
              <div
                key={i}
                className={`hero-bar flex-1 rounded-t-md ${i === liveBars.length - 1 ? "animate-pulse-soft" : ""}`}
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 55}ms`,
                  background:
                    i === liveBars.length - 1
                      ? "linear-gradient(180deg, var(--primary), var(--accent))"
                      : "color-mix(in oklab, var(--primary) 55%, var(--surface))",
                  opacity: 0.45 + i * 0.045,
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {PRIORITIES.map((row, i) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-[12px] text-[var(--muted)]">{row.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="hero-fill h-full rounded-full"
                  style={{
                    width: `${row.pct}%`,
                    background: row.color,
                    animationDelay: `${220 + i * 90}ms`,
                  }}
                />
              </div>
              <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-[var(--foreground)]">
                {row.pct}%
              </span>
            </div>
          ))}
        </div>

        <ul className="mt-4 space-y-1.5">
          {hits.map((hit) => (
            <li
              key={hit.id}
              className="hero-feed-in flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2"
            >
              <p className="text-[12px] text-[var(--foreground)]">
                <span className="font-semibold">{hit.zone}</span>
                <span className="text-[var(--muted)]"> · {hit.who}</span>
              </p>
              <span className="text-[11px] font-medium text-[var(--success)]">{agoLabel(hit.ago)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
