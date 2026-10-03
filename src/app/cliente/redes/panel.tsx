"use client";

import { useActionState, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, Heart, Loader2, Plus, Rss, Sparkles, Type, Upload } from "lucide-react";
import { createTrackerAction, importSocialAction, reclassifyAction, type SocialActionState } from "./actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { NETWORK_LABEL, type SocialNetwork, type SocialPost } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

// ---------------------------------------------------------------- filtros
export function SocialFilterBar({ topics, networks }: { topics: string[]; networks: SocialNetwork[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const days = search.get("dias") ?? "30";

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {["7", "30", "90"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => update("dias", d === "30" ? null : d)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              days === d ? "bg-[var(--primary)] text-[var(--primary-fg)]" : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {d} días
          </button>
        ))}
      </div>
      <select
        value={search.get("red") ?? ""}
        onChange={(e) => update("red", e.target.value || null)}
        className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--foreground)]"
      >
        <option value="">Todas las redes</option>
        {networks.map((n) => (
          <option key={n} value={n}>
            {NETWORK_LABEL[n]}
          </option>
        ))}
      </select>
      <select
        value={search.get("tema") ?? ""}
        onChange={(e) => update("tema", e.target.value || null)}
        className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--foreground)]"
      >
        <option value="">Todos los temas</option>
        {topics.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {pending ? <Loader2 className="size-4 animate-spin text-[var(--muted)]" /> : null}
    </div>
  );
}

// ------------------------------------------------------------------- feed
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
  const [tab, setTab] = useState<"neg" | "pos" | "rec">("neg");
  const posts = tab === "neg" ? negative : tab === "pos" ? positive : recent;

  return (
    <div>
      <div className="flex rounded-xl bg-[var(--surface-2)] p-1 text-xs font-semibold">
        {(
          [
            ["neg", "Críticas con más eco"],
            ["pos", "Elogios con más eco"],
            ["rec", "Recientes"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 transition-colors",
              tab === value ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2.5">
        {posts.length === 0 ? (
          <li className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            Sin publicaciones en este recorte.
          </li>
        ) : (
          posts.map((p) => (
            <li key={p.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 animate-rise">
              <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                <span className="size-2 rounded-full" style={{ background: NETWORK_DOT[p.network] }} />
                <span className="font-semibold text-[var(--foreground)]">{NETWORK_LABEL[p.network]}</span>
                <span>· {p.author ?? "anónimo"}</span>
                <span className="ml-auto">{timeAgo(p.published_at, now)}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">{p.text}</p>
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
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] tabular-nums text-[var(--muted)]">
                  <Heart className="size-3" />
                  {formatNumber(p.engagement)}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// -------------------------------------------------------------- importar
export function ImportPanel({ modelName }: { modelName: string | null }) {
  const [state, formAction] = useActionState<SocialActionState, FormData>(importSocialAction, {});
  const [mode, setMode] = useState<"csv" | "pegar" | "rss">("csv");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["csv", "CSV", FileSpreadsheet],
            ["pegar", "Pegar", Type],
            ["rss", "Noticias RSS", Rss],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors",
              mode === value ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)]",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === "csv" ? (
        <>
          <Field label="Archivo" hint="Exportación de tu herramienta de monitoreo o de Meta Business Suite. Columnas: fecha, red, autor, texto, url, interacciones.">
            <Input name="file" type="file" accept=".csv,text/csv" className="h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary-soft)] file:px-3 file:py-1 file:text-xs file:font-medium file:text-[var(--primary)]" />
          </Field>
          <Field label="…o pegá el CSV">
            <Textarea name="csv" rows={3} placeholder={"fecha;red;texto;interacciones\n12/09/2026;facebook;Tercer día sin agua en el barrio;42"} className="font-mono text-xs" />
          </Field>
        </>
      ) : null}

      {mode === "pegar" ? (
        <>
          <Field label="Red">
            <Select name="network" defaultValue="facebook">
              {(Object.keys(NETWORK_LABEL) as SocialNetwork[]).map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABEL[n]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Publicaciones o comentarios" hint="Uno por línea. Útil para comentarios de una publicación puntual.">
            <Textarea name="pasted" rows={5} placeholder={"Excelente la obra de la plaza!\nOtra vez sin recolección en el barrio 😡"} />
          </Field>
        </>
      ) : null}

      {mode === "rss" ? (
        <Field label="Dirección del feed" hint="Portales de noticias o Google Alertas (entregar a «Feed RSS»).">
          <Input name="rss_url" type="url" placeholder="https://www.google.com/alerts/feeds/…" />
        </Field>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <Sparkles className="size-3.5" />
        {modelName ? `Se clasifican con ${modelName} (detecta ironía y contexto).` : "Sin clave de TypeSafe ni Gemini: se clasifican con el léxico local."}
      </p>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}

      <SubmitButton pendingLabel="Importando y clasificando…" className="w-full">
        <Upload />
        Importar
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
      <SubmitButton pendingLabel="Creando…" variant="outline" size="sm" className="w-full">
        <Plus />
        Seguir tema
      </SubmitButton>
    </form>
  );
}

export function ReclassifyButton({ pending }: { pending: number }) {
  const [state, formAction] = useActionState<SocialActionState, FormData>(reclassifyAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton pendingLabel="Reclasificando…" variant="secondary" size="sm" className="w-full" disabled={!pending}>
        <Sparkles />
        Reclasificar {formatNumber(pending)} con IA
      </SubmitButton>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
    </form>
  );
}
