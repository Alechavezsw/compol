"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  CircleDot,
  Gauge,
  GitBranch,
  Hash,
  Plus,
  Sparkles,
  StopCircle,
  ToggleLeft,
  Type,
  X,
} from "lucide-react";
import { addQuestionAction, type ActionState } from "../../actions";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { looksExclusive } from "@/lib/survey-logic";
import { QUESTION_TYPE_LABEL, type QuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BranchSource = {
  id: string;
  position: number;
  text: string;
  type: QuestionType;
  options: { id: string; label: string }[];
};

const WITH_OPTIONS: QuestionType[] = ["opcion_unica", "opcion_multiple"];

const SECTIONS = ["Filtro", "Perfil", "Gestión", "Agenda", "Servicios", "Medios", "Abierta"];

const EVALUATION = ["Muy buena", "Buena", "Regular", "Mala", "Muy mala", "No sabe / No contesta"];

const PRESETS: { id: string; label: string; options: string[] }[] = [
  { id: "eval", label: "Evaluación", options: EVALUATION },
  {
    id: "acuerdo",
    label: "Acuerdo",
    options: [
      "Muy de acuerdo",
      "De acuerdo",
      "Ni de acuerdo ni en desacuerdo",
      "En desacuerdo",
      "Muy en desacuerdo",
      "No sabe / No contesta",
    ],
  },
  {
    id: "frec",
    label: "Frecuencia",
    options: ["Siempre", "Casi siempre", "A veces", "Casi nunca", "Nunca", "No sabe / No contesta"],
  },
  { id: "si", label: "Sí / No / Ns-Nc", options: ["Sí", "No", "No sabe / No contesta"] },
  {
    id: "prioridad",
    label: "Prioridad",
    options: ["Primera", "Segunda", "Tercera", "Ninguna / No sabe"],
  },
];

const SCALE_PRESETS = [
  { label: "1 a 5", min: 1, max: 5 },
  { label: "1 a 10", min: 1, max: 10 },
  { label: "0 a 10", min: 0, max: 10 },
];

const TYPE_META: {
  type: QuestionType;
  hint: string;
  icon: ReactNode;
}[] = [
  { type: "opcion_unica", hint: "Una sola marca. Ideal para evaluaciones.", icon: <CircleDot className="size-4" /> },
  { type: "opcion_multiple", hint: "Varias marcas. Podés poner un tope.", icon: <CheckSquare className="size-4" /> },
  { type: "si_no", hint: "Dos respuestas. Sirve como filtro.", icon: <ToggleLeft className="size-4" /> },
  { type: "escala", hint: "Puntaje, por ejemplo 1 a 10.", icon: <Gauge className="size-4" /> },
  { type: "numero", hint: "Edad, cantidad u otro número.", icon: <Hash className="size-4" /> },
  { type: "texto_corto", hint: "Una línea escrita.", icon: <Type className="size-4" /> },
  { type: "texto_largo", hint: "Respuesta abierta.", icon: <AlignLeft className="size-4" /> },
  { type: "fecha", hint: "Una fecha del calendario.", icon: <Calendar className="size-4" /> },
];

function Chip({
  name,
  value,
  label,
  tone = "primary",
}: {
  name: string;
  value: string;
  label: string;
  tone?: "primary" | "warning";
}) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value} className="peer sr-only" />
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors",
          tone === "primary"
            ? "peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary-soft)] peer-checked:text-[var(--primary)]"
            : "peer-checked:border-[var(--warning)] peer-checked:bg-[var(--warning-soft)] peer-checked:text-[var(--warning)]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring)]",
        )}
      >
        {label}
      </span>
    </label>
  );
}

export function QuestionForm({
  surveyId,
  sources,
  nextPosition = 1,
  wide = false,
}: {
  surveyId: string;
  sources: BranchSource[];
  nextPosition?: number;
  wide?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(addQuestionAction, {});
  const [type, setType] = useState<QuestionType>("opcion_unica");
  const [text, setText] = useState("");
  const [options, setOptions] = useState<string[]>(EVALUATION);
  const [section, setSection] = useState("");
  const [minValue, setMinValue] = useState(1);
  const [maxValue, setMaxValue] = useState(10);
  const [branchOn, setBranchOn] = useState("");
  const [formKey, setFormKey] = useState(0);
  const lastOk = useRef<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok && state.ok !== lastOk.current) {
      lastOk.current = state.ok;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio del formulario tras una acción exitosa
      setText("");
      setOptions(EVALUATION);
      setSection("");
      setBranchOn("");
      setType("opcion_unica");
      setMinValue(1);
      setMaxValue(10);
      setFormKey((k) => k + 1);
    }
  }, [state.ok]);

  const cleanOptions = useMemo(() => options.map((o) => o.trim()).filter(Boolean), [options]);
  const source = sources.find((s) => s.id === branchOn);
  const exclusives = type === "opcion_multiple" ? cleanOptions.filter(looksExclusive) : [];
  const meta = TYPE_META.find((t) => t.type === type)!;
  const ready =
    text.trim().length >= 3 && (!WITH_OPTIONS.includes(type) || cleanOptions.length >= 2);

  function applyPreset(next: string[]) {
    setOptions(next);
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function addOption(value = "") {
    setOptions((prev) => (prev.length >= 30 ? prev : [...prev, value]));
  }

  return (
    <form key={formKey} action={formAction} className="space-y-5">
      <input type="hidden" name="survey_id" value={surveyId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="options" value={cleanOptions.join("\n")} />
      <input type="hidden" name="section" value={section} />
      {type === "escala" ? (
        <>
          <input type="hidden" name="min_value" value={minValue} />
          <input type="hidden" name="max_value" value={maxValue} />
        </>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--primary)_18%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary-soft)_70%,var(--surface)),var(--surface))] p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-[color-mix(in_oklab,var(--primary)_16%,transparent)] blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-[var(--primary)] uppercase">
              <Sparkles className="size-3.5" />
              Pregunta {nextPosition}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">Escribí lo que se va a leer. Después elegí cómo se responde.</p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] shadow-[var(--shadow-card)]">
            {QUESTION_TYPE_LABEL[type]}
          </span>
        </div>
        <label className="relative mt-4 block">
          <span className="sr-only">Enunciado</span>
          <textarea
            name="text"
            required
            minLength={3}
            maxLength={500}
            rows={wide ? 3 : 2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="¿Cómo evalúa la gestión del gobierno municipal?"
            className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-[17px] leading-snug font-medium text-[var(--foreground)] shadow-[var(--shadow-card)] outline-none placeholder:font-normal placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_16%,transparent)]"
          />
          <span className="pointer-events-none absolute right-3 bottom-2.5 text-[10px] tabular-nums text-[var(--muted)]">
            {text.length}/500
          </span>
        </label>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-[var(--foreground)]">Cómo se responde</p>
        <div className={cn("grid gap-2", wide ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
          {TYPE_META.map((t) => {
            const active = type === t.type;
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => setType(t.type)}
                className={cn(
                  "flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-[0_10px_22px_-16px_var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border))] hover:bg-[var(--surface-2)]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-[var(--primary)] text-[var(--primary-fg)]" : "bg-[var(--surface-2)] text-[var(--muted)]",
                  )}
                >
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[var(--foreground)]">{QUESTION_TYPE_LABEL[t.type]}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)]">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {WITH_OPTIONS.includes(type) ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-[var(--foreground)]">
                Opciones <span className="font-normal text-[var(--muted)]">({cleanOptions.length})</span>
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">En el orden en que se leen. «No sabe» y «Ninguno» se vuelven excluyentes solas.</p>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const active = p.options.join("|") === cleanOptions.join("|");
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.options)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <ol className="space-y-1.5">
            {options.map((option, i) => (
              <li key={`${formKey}-${i}`} className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                  {i + 1}
                </span>
                <input
                  value={option}
                  maxLength={160}
                  onChange={(e) => updateOption(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                      requestAnimationFrame(() => addRef.current?.focus());
                    }
                  }}
                  placeholder={i === 0 ? "Primera opción" : "Siguiente opción"}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_16%,transparent)]"
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 2}
                  aria-label={`Quitar opción ${i + 1}`}
                  className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-30"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-2 flex items-center gap-2">
            <input
              ref={addRef}
              maxLength={160}
              placeholder="Agregar otra y Enter"
              className="h-10 min-w-0 flex-1 rounded-xl border border-dashed border-[var(--border)] bg-transparent px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--primary)]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim();
                  if (value) addOption(value);
                  else addOption();
                  e.currentTarget.value = "";
                }
              }}
            />
            <button
              type="button"
              onClick={() => addOption()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              <Plus className="size-3.5" />
              Opción
            </button>
          </div>
        </div>
      ) : null}

      {type === "opcion_multiple" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tope de marcas" hint="Vacío = sin tope.">
            <Input name="max_choices" type="number" min={1} max={Math.max(1, cleanOptions.length - 1)} placeholder="3" />
          </Field>
          {exclusives.length ? (
            <p className="self-center rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
              Excluyentes: <strong className="text-[var(--foreground)]">{exclusives.join(", ")}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {type === "escala" ? (
        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--foreground)]">Escala</p>
          <div className="flex flex-wrap gap-2">
            {SCALE_PRESETS.map((p) => {
              const active = minValue === p.min && maxValue === p.max;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setMinValue(p.min);
                    setMaxValue(p.max);
                  }}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)]",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {Array.from({ length: maxValue - minValue + 1 }, (_, i) => minValue + i).map((n) => (
              <span
                key={n}
                className="flex size-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold tabular-nums"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {type === "numero" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor mínimo" hint="Opcional">
            <Input name="min_value" type="number" placeholder="Sin mínimo" />
          </Field>
          <Field label="Valor máximo" hint="Opcional">
            <Input name="max_value" type="number" placeholder="Sin máximo" />
          </Field>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[13px] font-medium text-[var(--foreground)]">
          Sección <span className="font-normal text-[var(--muted)]">· agrupa en el cuestionario y en los cruces</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => {
            const active = section === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSection(active ? "" : s)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--foreground)]">
          Aclaración para el encuestador
          <span className="ml-auto text-xs font-normal text-[var(--muted)] group-open:hidden">Opcional</span>
        </summary>
        <div className="border-t border-[var(--border)] px-4 py-3">
          <Input name="help_text" placeholder="Leer las opciones en voz alta." maxLength={300} />
        </div>
      </details>

      <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)]" open={Boolean(branchOn)}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--foreground)]">
          <GitBranch className="size-4 text-[var(--primary)]" />
          Saltos y filtros
          <span className="ml-auto text-xs font-normal text-[var(--muted)] group-open:hidden">Opcional</span>
        </summary>
        <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">
          <Field
            label="Mostrar esta pregunta solo si…"
            hint={sources.length ? undefined : "Primero cargá una pregunta de opción o Sí/No para poder condicionar."}
          >
            <Select name="show_if_question" value={branchOn} onChange={(e) => setBranchOn(e.target.value)} disabled={!sources.length}>
              <option value="">Se muestra siempre</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  P{s.position}. {s.text.slice(0, 70)}
                </option>
              ))}
            </Select>
          </Field>

          {source ? (
            <div>
              <p className="mb-2 text-xs text-[var(--muted)]">…respondió alguna de estas:</p>
              <div className="flex flex-wrap gap-1.5">
                {(source.type === "si_no"
                  ? [
                      { id: "si", label: "Sí" },
                      { id: "no", label: "No" },
                    ]
                  : source.options
                ).map((o) => (
                  <Chip key={o.id} name="show_if_values" value={o.id} label={o.label} />
                ))}
              </div>
            </div>
          ) : null}

          {type === "si_no" || (type === "opcion_unica" && cleanOptions.length >= 2) ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--foreground)]">
                <StopCircle className="size-4 text-[var(--warning)]" />
                Pregunta filtro: terminar la entrevista si responde…
              </p>
              <div className="flex flex-wrap gap-1.5">
                {type === "si_no" ? (
                  <>
                    <Chip name="end_if_values" value="si" label="Sí" tone="warning" />
                    <Chip name="end_if_values" value="no" label="No" tone="warning" />
                  </>
                ) : (
                  cleanOptions.map((o, i) => <Chip key={`${o}-${i}`} name="end_if_values" value={`o${i + 1}`} label={o} tone="warning" />)
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                La entrevista se guarda como descartada: suma a la incidencia, no a los resultados.
              </p>
            </div>
          ) : null}
        </div>
      </details>

      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 p-4">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">Así se lee</p>
        <p className="mt-2 text-[15px] font-medium text-[var(--foreground)]">
          {text.trim() || "¿Cómo evalúa la gestión del gobierno municipal?"}
        </p>
        {type === "si_no" ? (
          <div className="mt-3 flex gap-2">
            {["Sí", "No"].map((o) => (
              <span key={o} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium">
                {o}
              </span>
            ))}
          </div>
        ) : WITH_OPTIONS.includes(type) ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {(cleanOptions.length ? cleanOptions : EVALUATION).map((o) => (
              <li
                key={o}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--foreground)]"
              >
                <span
                  className={cn(
                    "size-3 rounded-full border border-[var(--primary)]",
                    type === "opcion_multiple" && "rounded-[3px]",
                  )}
                />
                {o}
              </li>
            ))}
          </ul>
        ) : type === "escala" ? (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Escala {minValue} a {maxValue}
          </p>
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">{meta.hint}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 text-sm text-[var(--foreground)]">
          <input type="checkbox" name="is_required" defaultChecked className="size-4 rounded border-[var(--border)] accent-[var(--primary)]" />
          Respuesta obligatoria
        </label>
        <SubmitButton pendingLabel="Agregando…" className="w-full sm:w-auto" disabled={!ready}>
          <Plus />
          Agregar al cuestionario
        </SubmitButton>
      </div>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
    </form>
  );
}
