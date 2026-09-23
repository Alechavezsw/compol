"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

function useParams() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | null>, hash?: string) {
    const params = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(`${pathname}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`, { scroll: false });
    });
  }

  return { search, update, pending };
}

function MiniSelect({
  label,
  value,
  options = [],
  groups,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  options?: Option[];
  groups?: { label: string; options: Option[] }[];
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const active = Boolean(value);
  return (
    <label className={cn("group relative flex min-w-0 flex-col", className)}>
      <span className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full min-w-0 appearance-none truncate rounded-xl border bg-[var(--surface)] pr-8 pl-3 text-[13px] transition-colors focus:outline-none focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_16%,transparent)]",
          active
            ? "border-[var(--primary)] font-medium text-[var(--primary)]"
            : "border-[var(--border)] text-[var(--foreground)] hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border))]",
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.6rem center",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {groups?.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export type SegmentOption = { id: string; label: string; categories: { key: string; label: string }[] };

export function FilterBar({
  zones,
  surveyors,
  segments,
  channels = [],
  minDay,
  maxDay,
}: {
  zones: string[];
  surveyors: { id: string; name: string }[];
  segments: SegmentOption[];
  channels?: ("campo" | "web")[];
  minDay?: string;
  maxDay?: string;
}) {
  const { search, update, pending } = useParams();
  const channel = search.get("canal") ?? "";
  const zone = search.get("zona") ?? "";
  const surveyor = search.get("encuestador") ?? "";
  const from = search.get("desde") ?? "";
  const to = search.get("hasta") ?? "";
  const seg = search.get("segmento") ?? "";
  const activeCount = [channel, zone, surveyor, from, to, seg].filter(Boolean).length;

  const segmentGroups = segments.map((s) => ({
    label: s.label.length > 60 ? `${s.label.slice(0, 58)}…` : s.label,
    options: s.categories.map((c) => ({ value: `${s.id}:${c.key}`, label: c.label })),
  }));

  return (
    <div className="sticky top-2 z-20 rounded-[20px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_86%,transparent)] p-3 shadow-[0_18px_40px_-26px_rgba(30,20,70,.45)] backdrop-blur-xl lg:top-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex h-9 items-center gap-2 self-end pr-1 text-sm font-medium text-[var(--foreground)]">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-xl transition-colors",
              activeCount ? "bg-[var(--primary)] text-[var(--primary-fg)]" : "bg-[var(--surface-2)] text-[var(--muted)]",
            )}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Filter className="size-4" />}
          </span>
          <span className="hidden sm:inline">{activeCount ? `${activeCount} filtro${activeCount > 1 ? "s" : ""}` : "Filtros"}</span>
        </div>

        {channels.length > 1 ? (
          <MiniSelect
            label="Canal"
            value={channel}
            placeholder="Todos"
            options={[
              { value: "campo", label: "Campo" },
              { value: "web", label: "Web" },
            ]}
            onChange={(v) => update({ canal: v || null })}
            className="w-[calc(50%-0.5rem)] sm:w-28"
          />
        ) : null}
        {zones.length ? (
        <MiniSelect
          label="Zona"
          value={zone}
          placeholder="Todas"
          options={zones.map((z) => ({ value: z, label: z }))}
          onChange={(v) => update({ zona: v || null })}
          className="w-[calc(50%-0.5rem)] sm:w-36"
        />
        ) : null}
        {surveyors.length ? (
          <MiniSelect
            label="Encuestador"
            value={surveyor}
            placeholder="Todos"
            options={surveyors.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(v) => update({ encuestador: v || null })}
            className="w-[calc(50%-0.5rem)] sm:w-44"
          />
        ) : null}
        <MiniSelect
          label="Segmento"
          value={seg}
          placeholder="Toda la muestra"
          groups={segmentGroups}
          onChange={(v) => update({ segmento: v || null })}
          className="w-full sm:w-64"
        />

        <label className="flex flex-col">
          <span className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">Desde</span>
          <input
            type="date"
            value={from}
            min={minDay}
            max={to || maxDay}
            onChange={(e) => update({ desde: e.target.value || null })}
            className={cn(
              "h-9 rounded-xl border bg-[var(--surface)] px-2.5 text-[13px] focus:outline-none",
              from ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--foreground)]",
            )}
          />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">Hasta</span>
          <input
            type="date"
            value={to}
            min={from || minDay}
            max={maxDay}
            onChange={(e) => update({ hasta: e.target.value || null })}
            className={cn(
              "h-9 rounded-xl border bg-[var(--surface)] px-2.5 text-[13px] focus:outline-none",
              to ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--foreground)]",
            )}
          />
        </label>

        {activeCount ? (
          <button
            type="button"
            onClick={() => update({ canal: null, zona: null, encuestador: null, desde: null, hasta: null, segmento: null })}
            className="inline-flex h-9 items-center gap-1.5 self-end rounded-xl px-3 text-[13px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          >
            <X className="size-3.5" />
            Limpiar
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CrosstabPicker({
  targets,
  variables,
  target,
  by,
}: {
  targets: Option[];
  variables: Option[];
  target: string;
  by: string;
}) {
  const { update, pending } = useParams();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <MiniSelect
        label="Pregunta"
        value={target}
        placeholder="Elegir pregunta…"
        options={targets}
        onChange={(v) => update({ cruce: v || null }, "cruces")}
        className="w-full sm:w-80"
      />
      <span className="hidden h-9 items-center text-sm text-[var(--muted)] sm:flex">según</span>
      <MiniSelect
        label="Abrir por"
        value={by}
        placeholder="Elegir variable…"
        options={variables.filter((v) => v.value !== target)}
        onChange={(v) => update({ por: v || null }, "cruces")}
        className="w-full sm:w-72"
      />
      {pending ? <Loader2 className="mb-2.5 size-4 animate-spin text-[var(--muted)]" /> : null}
    </div>
  );
}
