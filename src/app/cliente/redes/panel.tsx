"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, Heart, Loader2, Plus, Radio, Rss, Sparkles, Type, Upload } from "lucide-react";
import {
  analyzeRadarAction,
  createSourceAction,
  createTrackerAction,
  importSocialAction,
  listenMetaAction,
  reclassifyAction,
  type SocialActionState,
} from "./actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { NETWORK_LABEL, type SocialNetwork, type SocialPost } from "@/lib/types";
import { cleanHeadline } from "@/lib/social/headline";
import { RadarIgnition } from "./radar-visual";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

export function SocialFilterBar({
  topics,
  networks,
  counts,
}: {
  topics: string[];
  networks: SocialNetwork[];
  counts: { 1: number; 7: number; 30: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(search.get("q") ?? "");
  const days = search.get("dias") ?? "1";

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="flex h-11 min-w-[220px] flex-1 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4"
        onSubmit={(event) => {
          event.preventDefault();
          update("q", q.trim() || null);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar notas o un tema para el radar"
          className="h-full w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        />
      </form>
      <div className="flex h-11 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
        {(["1", "7", "30"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => update("dias", d === "1" ? null : d)}
            className={cn(
              "h-9 rounded-full px-3.5 text-xs font-semibold transition-colors",
              days === d ? "bg-[var(--foreground)] text-[var(--surface)]" : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {d === "1" ? "Hoy" : d === "7" ? "Semana" : "Mes"}
            <span className="ml-1.5 tabular-nums opacity-70">{counts[d]}</span>
          </button>
        ))}
      </div>
      {networks.length > 1 ? (
        <select
          value={search.get("red") ?? ""}
          onChange={(e) => update("red", e.target.value || null)}
          className="h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-medium"
        >
          <option value="">Todas las fuentes</option>
          {networks.map((n) => (
            <option key={n} value={n}>
              {NETWORK_LABEL[n]}
            </option>
          ))}
        </select>
      ) : null}
      {topics.length ? (
        <select
          value={search.get("tema") ?? ""}
          onChange={(e) => update("tema", e.target.value || null)}
          className="h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-medium"
        >
          <option value="">Todos los temas</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      ) : null}
      {pending ? <Loader2 className="size-4 animate-spin text-[var(--muted)]" /> : null}
    </div>
  );
}

const NETWORK_DOT: Record<SocialNetwork, string> = {
  x: "#111827",
  facebook: "#1877f2",
  instagram: "#e1306c",
  tiktok: "#00b8b0",
  youtube: "#ff0033",
  noticias: "#b45309",
  otros: "#64748b",
};

function timeAgo(iso: string, now: number) {
  const h = Math.round((now - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "hace minutos";
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export function PostFeed({
  negative,
  positive,
  recent,
  now,
}: {
  negative: SocialPost[];
  positive: SocialPost[];
  recent: SocialPost[];
  now: number;
}) {
  const [tab, setTab] = useState<"rec" | "neg" | "pos">("rec");
  const posts = tab === "neg" ? negative : tab === "pos" ? positive : recent;

  return (
    <div>
      <div className="flex rounded-full bg-[var(--surface-2)] p-1 text-xs font-semibold">
        {(
          [
            ["rec", "Lo último"],
            ["neg", "Más críticas"],
            ["pos", "Más elogios"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "flex-1 rounded-full px-2 py-1.5 transition-colors",
              tab === value ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2.5">
        {posts.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            Todavía no hay publicaciones en este recorte.
          </li>
        ) : (
          posts.map((p) => (
            <li key={p.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                <span className="size-2 rounded-full" style={{ background: NETWORK_DOT[p.network] }} />
                <span className="font-semibold text-[var(--foreground)]">{NETWORK_LABEL[p.network]}</span>
                {p.author ? <span>· {p.author}</span> : null}
                <span className="ml-auto">{timeAgo(p.published_at, now)}</span>
              </div>
              <p className="mt-2 text-[15px] leading-snug font-medium text-[var(--foreground)]">{cleanHeadline(p.text)}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                    p.label === "positivo"
                      ? "bg-[var(--success-soft)] text-[var(--success)]"
                      : p.label === "negativo"
                        ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                        : "bg-[var(--surface-2)] text-[var(--muted)]",
                  )}
                >
                  {p.label}
                </span>
                {p.topics.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                    {t}
                  </span>
                ))}
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--primary)] underline-offset-2 hover:underline">
                    Ver original
                  </a>
                ) : null}
                {p.engagement > 0 ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] tabular-nums text-[var(--muted)]">
                    <Heart className="size-3" />
                    {formatNumber(p.engagement)}
                  </span>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function ListenButton({ label = "Encender radar" }: { label?: string }) {
  return <RadarIgnition label={label} />;
}

export function RadarActionBar({
  canListen,
  days,
  notes,
  lastSync,
}: {
  canListen: boolean;
  days: number;
  notes: number;
  lastSync?: string | null;
}) {
  const [state, action, pending] = useActionState(analyzeRadarAction, {});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
      <div className="flex h-12 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-card)]">
        {canListen ? <RadarIgnition grouped /> : null}
        <form action={action} className="contents">
          <input type="hidden" name="dias" value={String(days)} />
          <Button
            type="submit"
            variant={canListen ? "ghost" : "primary"}
            disabled={pending || notes < 1}
            className={cn(
              "h-10 rounded-full px-4 hover:translate-y-0",
              canListen &&
                "text-[var(--foreground)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]",
            )}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Analizando…" : "Informe IA"}
          </Button>
        </form>
      </div>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {canListen && lastSync ? (
        <p suppressHydrationWarning className="text-right text-[11px] text-[var(--muted)]">
          Última búsqueda {formatDateTime(lastSync)}
        </p>
      ) : null}
      {mounted && pending
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-[#120f0c]/88 p-4 backdrop-blur-xl"
              role="status"
              aria-live="polite"
            >
              <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#1a1612] px-7 py-8 text-center text-white shadow-[0_40px_120px_-24px_rgba(0,0,0,0.65)]">
                <p className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-amber-100 uppercase">
                  <Sparkles className="size-3.5" />
                  Informe IA
                </p>
                <h2 className="display mt-4 text-[28px] leading-none">La IA está leyendo las notas</h2>
                <p className="mt-3 text-sm text-white/65">
                  JEV y Gemini arman el reporte con gráficos. En un momento lo vas a poder bajar en PDF.
                </p>
                <div className="mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-amber-200/20">
                  <div className="h-full w-2/5 animate-pulse rounded-full bg-amber-200" />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function MetaListenButton() {
  const router = useRouter();
  const [state, setState] = useState<SocialActionState>({});
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setState({});
            const next = await listenMetaAction();
            setState(next);
            if (next.ok) router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Radio />}
        {pending ? "Leyendo Facebook e Instagram…" : "Leer Facebook e Instagram"}
      </Button>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
    </div>
  );
}

export function ImportPanel() {
  const [state, formAction] = useActionState<SocialActionState, FormData>(importSocialAction, {});
  const [mode, setMode] = useState<"pegar" | "csv" | "rss">("pegar");
  const [network, setNetwork] = useState<SocialNetwork>("facebook");
  const social = network === "facebook" || network === "instagram";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["pegar", "Texto o links", Type],
            ["csv", "Archivo CSV", FileSpreadsheet],
            ["rss", "Feed RSS", Rss],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors",
              mode === value
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)]",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === "csv" ? (
        <>
          <Field label="Archivo" hint="Columnas: fecha, red, texto. También sirve pegar el CSV abajo.">
            <Input
              name="file"
              type="file"
              accept=".csv,text/csv"
              className="h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary-soft)] file:px-3 file:py-1 file:text-xs file:font-medium file:text-[var(--primary)]"
            />
          </Field>
          <Field label="…o pegá el CSV">
            <Textarea
              name="csv"
              rows={3}
              placeholder={"fecha;red;texto\n03/10/2026;facebook;Tercer día sin agua en el barrio"}
              className="font-mono text-xs"
            />
          </Field>
        </>
      ) : null}

      {mode === "pegar" ? (
        <>
          <Field label="De dónde salen">
            <Select name="network" value={network} onChange={(e) => setNetwork(e.target.value as SocialNetwork)}>
              {(Object.keys(NETWORK_LABEL) as SocialNetwork[]).map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABEL[n]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={social ? "Comentarios (uno por línea)" : "Comentarios o links"}
            hint={
              social
                ? "Meta no deja leer el muro solo con el link. Copiá el texto del comentario o del post."
                : "Un comentario por línea. Si pegás un link público de un diario, se lee el título."
            }
          >
            <Textarea
              name="pasted"
              rows={5}
              placeholder={
                social
                  ? "Excelente la obra de la plaza\nOtra vez sin recolección en el barrio\n¿Cuándo arreglan la vereda de Rawson?"
                  : "Excelente la obra de la plaza\nOtra vez sin recolección en el barrio"
              }
            />
          </Field>
          {social ? (
            <p className="rounded-xl bg-[var(--primary-soft)] px-3 py-2 text-[11px] leading-relaxed text-[var(--primary)]">
              Este menú marca la red. Para leer la Página oficial sola, usá «Leer Facebook e Instagram» (hace falta
              conectar Meta en el servidor).
            </p>
          ) : null}
        </>
      ) : null}

      {mode === "rss" ? (
        <Field label="Dirección del feed" hint="Queda guardada como fuente para volver a escucharla.">
          <Input name="rss_url" type="url" placeholder="https://…" />
        </Field>
      ) : null}

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}

      <SubmitButton pendingLabel="Guardando en la base…" className="w-full">
        <Upload />
        Guardar publicaciones
      </SubmitButton>
    </form>
  );
}

export function SourceForm() {
  const [state, formAction] = useActionState<SocialActionState, FormData>(createSourceAction, {});
  const [kind, setKind] = useState<"noticias" | "rss">("noticias");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex rounded-full bg-[var(--surface-2)] p-1 text-xs font-semibold">
        {(
          [
            ["noticias", "Búsqueda de noticias"],
            ["rss", "Feed RSS"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={cn(
              "flex-1 rounded-full px-2 py-1.5",
              kind === value ? "bg-[var(--surface)] shadow-sm" : "text-[var(--muted)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <Input name="name" placeholder="Nombre de la fuente" maxLength={80} required />
      {kind === "noticias" ? (
        <Input name="query" placeholder="Municipalidad San Juan" required />
      ) : (
        <Input name="url" type="url" placeholder="https://…/rss" required />
      )}
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <SubmitButton pendingLabel="Guardando…" variant="outline" size="sm" className="w-full">
        <Plus />
        Guardar fuente
      </SubmitButton>
    </form>
  );
}

export function TrackerForm() {
  const [state, formAction] = useActionState<SocialActionState, FormData>(createTrackerAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <Input name="name" placeholder="Nombre del tema (ej. Terminal de ómnibus)" maxLength={60} required />
      <Input name="keywords" placeholder="Palabras clave, separadas por coma" required />
      <Input name="exclude" placeholder="Excluir si contiene… (opcional)" />
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <SubmitButton pendingLabel="Guardando…" variant="outline" size="sm" className="w-full">
        <Plus />
        Guardar tema
      </SubmitButton>
    </form>
  );
}

export function ReclassifyButton({ pending }: { pending: number }) {
  const [state, formAction] = useActionState<SocialActionState, FormData>(reclassifyAction, {});
  if (!pending) return null;
  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton pendingLabel="Actualizando…" variant="secondary" size="sm" className="w-full">
        Revisar {formatNumber(pending)} clasificaciones
      </SubmitButton>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
    </form>
  );
}
