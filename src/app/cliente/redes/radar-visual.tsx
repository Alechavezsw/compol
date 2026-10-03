"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Radio } from "lucide-react";
import { listenNowAction, type SocialActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { cn, formatDateTime, formatNumber, formatPercent } from "@/lib/utils";

const SCAN_LINES = [
  "Encendiendo el radar…",
  "Leyendo portales de San Juan…",
  "Filtrando notas reales de la ciudad…",
  "Midiendo el tono de cada nota…",
  "Guardando en la base…",
];

const PORTALS = ["Diario de Cuyo", "El Zonda", "Diario Huarpe", "Tiempo de San Juan", "Diario 13", "San Juan 8"];

export function RadarIgnition({ label = "Encender radar" }: { label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<SocialActionState>({});
  const [pending, start] = useTransition();
  const [line, setLine] = useState(0);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hits, setHits] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pending) {
      setLine(0);
      return;
    }
    const id = window.setInterval(() => setLine((n) => (n + 1) % SCAN_LINES.length), 1400);
    return () => window.clearInterval(id);
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    setHits(0);
    const id = window.setInterval(() => setHits((n) => Math.min(n + 1 + Math.floor(Math.random() * 2), 24)), 320);
    return () => window.clearInterval(id);
  }, [pending]);

  useEffect(() => {
    if (pending || !open || !state.ok) return;
    if (state.headlines?.length) return;
    const id = window.setTimeout(() => setOpen(false), 2800);
    return () => window.clearTimeout(id);
  }, [pending, open, state.ok, state.headlines]);

  return (
    <>
      <div className="flex w-full max-w-sm flex-col items-stretch gap-2 lg:items-end">
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={() => {
            setState({});
            setHits(0);
            setOpen(true);
            start(async () => {
              const next = await listenNowAction();
              setState(next);
              if (next.ok) router.refresh();
              if (next.error) setOpen(false);
            });
          }}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Radio />}
          {pending ? "Escaneando…" : label}
        </Button>
        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state.ok ? <p className="text-right text-xs text-[var(--success)]">{state.ok}</p> : null}
      </div>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-[#04070f]/94 p-4 backdrop-blur-xl sm:p-8"
              role="dialog"
              aria-modal="true"
              aria-live="polite"
              aria-label={pending ? "Radar encendido" : "Pasada lista"}
            >
              <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(94,234,212,0.22)_1px,transparent_1px)] [background-size:26px_26px]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <div className="relative w-full max-w-4xl overflow-hidden rounded-[32px] border border-cyan-200/15 bg-[#070b14] px-5 py-7 text-slate-100 shadow-[0_40px_120px_-24px_rgba(45,212,191,0.55)] sm:px-10 sm:py-10">
                <div className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-teal-400/20 blur-3xl" />
                <div className="pointer-events-none absolute -right-16 bottom-0 size-64 rounded-full bg-violet-500/25 blur-3xl" />
                {pending ? (
                  <div className="radar-scanline pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-300/20 to-transparent" />
                ) : null}
                <div className="relative grid items-center gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <RadarScope topics={[]} mood={pending ? hits : state.headlines?.length ?? 0} scanning={pending} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-cyan-200 uppercase">
                        <span className="size-1.5 animate-pulse rounded-full bg-cyan-300" />
                        {pending ? "Radar encendido" : "Pasada lista"}
                      </p>
                      <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                        {pending ? `${hits} señales` : `${state.headlines?.length ?? 0} notas`}
                      </p>
                    </div>
                    <h2 className="display mt-4 text-[30px] leading-none text-white sm:text-[40px]">
                      {pending ? SCAN_LINES[line] : state.ok}
                    </h2>
                    <p className="mt-3 text-sm text-slate-400">
                      {pending
                        ? `Recorriendo ${PORTALS[line % PORTALS.length]} y el resto de los diarios de San Juan, Argentina.`
                        : "Titulares públicos, tal como salieron en los portales locales."}
                    </p>
                    {pending ? (
                      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {PORTALS.map((portal, i) => (
                          <li
                            key={portal}
                            className={cn(
                              "rounded-xl border px-3 py-2 text-[12px] transition-colors",
                              i === line % PORTALS.length
                                ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                                : "border-white/10 bg-white/5 text-slate-400",
                            )}
                          >
                            {portal}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {state.headlines?.length ? (
                      <ul className="mt-5 space-y-2">
                        {state.headlines.slice(0, 6).map((h, i) => (
                          <li
                            key={h}
                            className="radar-headline-in rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] leading-snug text-slate-100"
                            style={{ animationDelay: `${i * 80}ms` }}
                          >
                            {h}
                          </li>
                        ))}
                      </ul>
                    ) : pending ? (
                      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-2/5 animate-pulse rounded-full bg-cyan-300" />
                      </div>
                    ) : null}
                    {!pending && state.ok ? (
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="mt-6 text-xs font-medium text-cyan-200 hover:text-white"
                      >
                        Cerrar
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export type RadarTopic = { name: string; volume: number; mood: number };
export type RadarSplit = { positivo: number; neutral: number; negativo: number };

function moodColor(mood: number) {
  if (mood >= 10) return "#4ade80";
  if (mood <= -10) return "#f87171";
  return "#fbbf24";
}

function RadarScope({
  topics,
  mood,
  scanning,
}: {
  topics: RadarTopic[];
  mood: number;
  scanning: boolean;
}) {
  const max = Math.max(...topics.map((t) => t.volume), 1);
  const blips = topics.slice(0, 8).map((t, i, all) => {
    const angle = (i / Math.max(all.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const dist = 34 + (1 - t.volume / max) * 52;
    return {
      ...t,
      x: 100 + Math.cos(angle) * dist,
      y: 100 + Math.sin(angle) * dist,
      color: moodColor(t.mood),
    };
  });

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]">
      <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle_at_center,#12352f_0%,#07131d_58%,#04080f_100%)] shadow-[inset_0_0_80px_rgba(45,212,191,0.18)]" />
      <div className="absolute inset-[10%] rounded-full border border-teal-400/20" />
      <div className="absolute inset-[22%] rounded-full border border-teal-400/15" />
      <div className="absolute inset-[36%] rounded-full border border-teal-400/12" />
      <div className="absolute inset-[50%] rounded-full border border-violet-400/20" />
      <div className="absolute left-1/2 top-[8%] h-[84%] w-px -translate-x-1/2 bg-teal-300/15" />
      <div className="absolute top-1/2 left-[8%] h-px w-[84%] -translate-y-1/2 bg-teal-300/15" />
      <div
        className={cn(
          "absolute inset-[10%] rounded-full",
          scanning ? "radar-spin-fast" : "radar-spin",
        )}
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0 68%, rgba(45,212,191,0.08) 82%, rgba(139,124,255,0.22) 94%, rgba(165,243,252,0.85) 100%)",
        }}
      />
      {scanning ? (
        <>
          <div className="radar-ping absolute inset-[18%] rounded-full border border-cyan-300/50" />
          <div className="radar-ping absolute inset-[18%] rounded-full border border-violet-300/40 [animation-delay:800ms]" />
        </>
      ) : null}
      <svg viewBox="0 0 200 200" className="absolute inset-0">
        {blips.map((b) => (
          <g key={b.name}>
            <circle cx={b.x} cy={b.y} r="7" fill={b.color} opacity="0.2" className="radar-blip" />
            <circle cx={b.x} cy={b.y} r="3.2" fill={b.color} />
            <text
              x={b.x}
              y={b.y - 9}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="4.6"
              fontWeight="600"
            >
              {b.name}
            </text>
          </g>
        ))}
        <circle cx="100" cy="100" r="16" fill="#04080f" stroke="rgba(45,212,191,0.45)" />
        <text x="100" y="98" textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="700">
          {mood > 0 ? "+" : ""}
          {Math.round(mood)}
        </text>
        <text x="100" y="108" textAnchor="middle" fill="#94a3b8" fontSize="4.4">
          tono
        </text>
      </svg>
    </div>
  );
}

export function RadarHero({
  organizationName,
  canManage,
  live,
  mood,
  moodText,
  split,
  total,
  topics,
  lastSync,
  days,
}: {
  organizationName: string;
  canManage: boolean;
  live: boolean;
  mood: number;
  moodText: string;
  split: RadarSplit;
  total: number;
  topics: RadarTopic[];
  lastSync?: string | null;
  days: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<SocialActionState>({});
  const [pending, start] = useTransition();
  const [line, setLine] = useState(0);
  const favor = total ? (split.positivo / total) * 100 : 0;
  const contra = total ? (split.negativo / total) * 100 : 0;

  useEffect(() => {
    if (!pending) {
      setLine(0);
      return;
    }
    const id = window.setInterval(() => setLine((n) => (n + 1) % SCAN_LINES.length), 1300);
    return () => window.clearInterval(id);
  }, [pending]);

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[#070b14] text-slate-100 shadow-[0_24px_80px_-28px_rgba(45,212,191,0.35)]">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-teal-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 size-64 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:p-10">
        <RadarScope topics={topics} mood={mood} scanning={pending || !live} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase",
                pending
                  ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
                  : live
                    ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                    : "border-white/15 bg-white/5 text-slate-300",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  pending ? "animate-pulse bg-cyan-300" : live ? "animate-pulse bg-emerald-300" : "bg-slate-500",
                )}
              />
              {pending ? "Escaneando" : live ? "Radar en vivo" : "Radar en espera"}
            </span>
            {lastSync ? (
              <span className="text-[11px] text-slate-400">Última pasada {formatDateTime(lastSync)}</span>
            ) : null}
          </div>

          <h1 className="display mt-4 text-[36px] leading-[0.95] text-white sm:text-[44px]">
            {pending ? SCAN_LINES[line] : live ? "El radar está leyendo la ciudad" : "Activá el radar"}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            {pending
              ? `Recorremos internet por ${organizationName} y cada tema. Las notas nuevas quedan guardadas.`
              : live
                ? `Tono de la conversación pública sobre ${organizationName} en los últimos ${days} días.`
                : `Un toque y el sistema busca solo en internet, clasifica el humor y arma el tablero.`}
          </p>

          {live && !pending ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Notas", formatNumber(total)],
                ["Tono", `${mood > 0 ? "+" : ""}${Math.round(mood)}`],
                ["A favor", formatPercent(favor)],
                ["En contra", formatPercent(contra)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
                  <p className="display mt-1 text-[22px] leading-none text-white tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {live && !pending ? (
            <div className="mt-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                <div className="bg-emerald-400" style={{ width: `${favor}%` }} />
                <div className="bg-slate-500" style={{ width: `${total ? (split.neutral / total) * 100 : 0}%` }} />
                <div className="bg-rose-400" style={{ width: `${contra}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Clima <span className="font-semibold text-white">{moodText}</span>
                {split.positivo ? ` · ${formatNumber(split.positivo)} a favor` : ""}
                {split.negativo ? ` · ${formatNumber(split.negativo)} en contra` : ""}
              </p>
            </div>
          ) : null}

          {canManage ? (
            <div className="mt-6 flex flex-col items-start gap-2">
              <Button
                type="button"
                size="lg"
                disabled={pending}
                className="h-13 min-w-[220px] bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                onClick={() =>
                  start(async () => {
                    setState({});
                    const next = await listenNowAction();
                    setState(next);
                    if (next.ok) router.refresh();
                  })
                }
              >
                {pending ? <Loader2 className="animate-spin" /> : <Radio />}
                {pending ? "Activando radar…" : "Activar radar"}
              </Button>
              {state.error ? <FormMessage>{state.error}</FormMessage> : null}
              {state.ok ? <p className="text-xs text-emerald-300">{state.ok}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
