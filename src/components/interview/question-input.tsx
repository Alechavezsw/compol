"use client";

import { Check } from "lucide-react";
import { isExclusiveOption, maxChoices, numericRange, type AnswerValue } from "@/lib/survey-logic";
import type { QuestionWithOptions } from "@/lib/types";
import { cn } from "@/lib/utils";

const choice =
  "group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-[15px] leading-snug transition-all duration-150 active:scale-[.99]";
const idle =
  "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] hover:bg-[color-mix(in_oklab,var(--primary)_4%,var(--surface))]";
const on =
  "border-[var(--primary)] bg-[var(--primary-soft)] font-medium text-[var(--primary)] shadow-[0_8px_20px_-14px_var(--primary)]";

function Key({ n, active }: { n: number; active: boolean }) {
  if (n > 9) return null;
  return (
    <kbd
      className={cn(
        "ml-auto hidden size-6 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] sm:flex",
        active
          ? "border-[color-mix(in_oklab,var(--primary)_35%,transparent)] text-[var(--primary)]"
          : "border-[var(--border)] text-[var(--muted)]",
      )}
    >
      {n}
    </kbd>
  );
}

/**
 * Marca o desmarca una opción múltiple respetando las excluyentes ("No sabe",
 * "Ninguno") y el tope de marcas. Lo comparten el click y el teclado.
 */
export function toggleOption(
  question: QuestionWithOptions,
  selected: string[],
  optionId: string,
): { value?: AnswerValue; limit?: string } {
  if (selected.includes(optionId)) {
    const rest = selected.filter((id) => id !== optionId);
    return { value: rest.length ? { optionIds: rest } : undefined };
  }
  const exclusiveIds = new Set(question.options.filter(isExclusiveOption).map((o) => o.id));
  if (exclusiveIds.has(optionId)) return { value: { optionIds: [optionId] } };
  const base = selected.filter((id) => !exclusiveIds.has(id));
  const limit = maxChoices(question);
  if (limit && base.length >= limit) {
    return { limit: `Se pueden marcar hasta ${limit} opciones. Desmarcá una para elegir otra.` };
  }
  return { value: { optionIds: [...base, optionId] } };
}

/**
 * Controles de respuesta para cualquier tipo de pregunta. `onPick` se usa en
 * las de un solo toque (el motor avanza solo); `onChange` en las que requieren
 * más de una acción (múltiple, número, texto).
 */
export function QuestionInput({
  question,
  value,
  onChange,
  onPick,
  onLimit,
  large = false,
}: {
  question: QuestionWithOptions;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  onPick?: (value: AnswerValue) => void;
  onLimit?: (message: string) => void;
  large?: boolean;
}) {
  const selected = value?.optionIds ?? [];
  const pick = onPick ?? onChange;

  switch (question.type) {
    case "opcion_unica":
      return (
        <div className="space-y-2" role="radiogroup">
          {question.options.map((o, i) => {
            const active = selected[0] === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pick({ optionIds: [o.id] })}
                className={cn(choice, active ? on : idle, isExclusiveOption(o) && !active && "text-[var(--muted)]")}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    active ? "border-[var(--primary)]" : "border-[var(--border)] group-hover:border-[var(--primary)]",
                  )}
                >
                  {active ? <span className="size-2.5 rounded-full bg-[var(--primary)]" /> : null}
                </span>
                <span className="min-w-0 flex-1">{o.label}</span>
                <Key n={i + 1} active={active} />
              </button>
            );
          })}
        </div>
      );

    case "opcion_multiple": {
      const limit = maxChoices(question);
      const exclusiveIds = new Set(question.options.filter(isExclusiveOption).map((o) => o.id));
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted)]">
            {limit ? `Hasta ${limit} opciones` : "Puede elegir varias"} ·{" "}
            <span className={cn(selected.length && "text-[var(--primary)]")}>
              {selected.length} {selected.length === 1 ? "marcada" : "marcadas"}
            </span>
          </p>
          {question.options.map((o, i) => {
            const active = selected.includes(o.id);
            const exclusive = exclusiveIds.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => {
                  const result = toggleOption(question, selected, o.id);
                  if (result.limit) onLimit?.(result.limit);
                  else onChange(result.value);
                }}
                className={cn(choice, active ? on : idle, exclusive && "border-dashed")}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-fg)]"
                      : "border-[var(--border)] group-hover:border-[var(--primary)]",
                  )}
                >
                  {active ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">{o.label}</span>
                <Key n={i + 1} active={active} />
              </button>
            );
          })}
        </div>
      );
    }

    case "si_no":
      return (
        <div className="grid grid-cols-2 gap-3" role="radiogroup">
          {(
            [
              ["si", "Sí", 1],
              ["no", "No", 2],
            ] as const
          ).map(([v, label, n]) => {
            const active = value?.text === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pick({ text: v })}
                className={cn(
                  "relative rounded-2xl border px-4 font-semibold transition-all active:scale-[.98]",
                  large ? "py-8 text-2xl" : "py-6 text-lg",
                  active ? on : idle,
                )}
              >
                {label}
                <span className="absolute top-2 right-2">
                  <Key n={n} active={active} />
                </span>
              </button>
            );
          })}
        </div>
      );

    case "escala": {
      const { min, max } = numericRange(question) as { min: number; max: number };
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      // En el celular, filas de 5 o 6; en pantallas anchas, toda la escala en una línea.
      const basis = steps.length > 10 ? "basis-[calc(16.66%-0.5rem)]" : "basis-[calc(20%-0.5rem)]";
      return (
        <div>
          <div className="flex flex-wrap gap-2">
            {steps.map((n) => {
              const active = value?.number === n;
              const t = (n - min) / Math.max(1, max - min);
              const tone = t >= 0.75 ? "var(--success)" : t <= 0.4 ? "var(--danger)" : "var(--warning)";
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => pick({ number: n })}
                  aria-pressed={active}
                  className={cn(
                    "relative h-14 grow rounded-2xl border text-lg font-semibold tabular-nums transition-all active:scale-95 sm:basis-0",
                    basis,
                    active
                      ? "border-transparent text-white shadow-[0_10px_22px_-12px_var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:-translate-y-0.5",
                  )}
                  style={active ? { background: `linear-gradient(160deg, ${tone}, color-mix(in oklab, ${tone} 70%, black))` } : undefined}
                >
                  {n}
                  {!active ? (
                    <span className="absolute inset-x-3 bottom-1.5 h-0.5 rounded-full opacity-60" style={{ background: tone }} />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
            <span>{min} · Nada</span>
            <span>{max} · Totalmente</span>
          </div>
        </div>
      );
    }

    case "numero": {
      const { min, max } = numericRange(question);
      return (
        <div>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            min={min ?? undefined}
            max={max ?? undefined}
            className="h-16 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 text-2xl font-semibold tabular-nums text-[var(--foreground)] placeholder:text-base placeholder:font-normal placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_16%,transparent)] focus:outline-none"
            value={value?.number ?? ""}
            onChange={(e) => {
              const raw = e.target.value.replace(",", ".");
              onChange(raw === "" ? undefined : { number: Number(raw) });
            }}
            placeholder="Ingresar número"
          />
          {min !== null || max !== null ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {min !== null && max !== null ? `Entre ${min} y ${max}` : min !== null ? `Mínimo ${min}` : `Máximo ${max}`}
            </p>
          ) : null}
        </div>
      );
    }

    case "fecha":
      return (
        <input
          type="date"
          className="h-16 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 text-lg text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_16%,transparent)] focus:outline-none"
          value={value?.date ?? ""}
          onChange={(e) => onChange(e.target.value ? { date: e.target.value } : undefined)}
        />
      );

    case "texto_largo":
      return (
        <div>
          <textarea
            rows={5}
            autoFocus
            maxLength={4000}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base leading-relaxed text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_16%,transparent)] focus:outline-none"
            value={value?.text ?? ""}
            onChange={(e) => onChange(e.target.value ? { text: e.target.value } : undefined)}
            placeholder="Escribí la respuesta…"
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-[var(--muted)]">
            {(value?.text?.length ?? 0).toLocaleString("es-AR")} / 4.000
          </p>
        </div>
      );

    default:
      return (
        <input
          autoFocus
          maxLength={300}
          className="h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_16%,transparent)] focus:outline-none"
          value={value?.text ?? ""}
          onChange={(e) => onChange(e.target.value ? { text: e.target.value } : undefined)}
          placeholder="Respuesta"
        />
      );
  }
}

/** Atajos de teclado: dígitos eligen, Enter avanza, Escape vuelve. */
export function handleInterviewKey(
  event: KeyboardEvent,
  question: QuestionWithOptions | undefined,
  value: AnswerValue | undefined,
  actions: {
    onChange: (v: AnswerValue | undefined) => void;
    onPick: (v: AnswerValue) => void;
    next: () => void;
    prev: () => void;
    onLimit?: (message: string) => void;
  },
) {
  if (!question || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

  if (event.key === "Enter") {
    if (target?.tagName === "TEXTAREA" && !event.shiftKey) return;
    if (target?.tagName === "BUTTON") return;
    event.preventDefault();
    actions.next();
    return;
  }
  if (typing) return;
  if (event.key === "Escape") {
    actions.prev();
    return;
  }

  const digit = Number(event.key);
  if (!Number.isInteger(digit) || event.key === " ") return;

  if (question.type === "opcion_unica" && digit >= 1 && digit <= question.options.length) {
    actions.onPick({ optionIds: [question.options[digit - 1].id] });
  } else if (question.type === "si_no" && (digit === 1 || digit === 2)) {
    actions.onPick({ text: digit === 1 ? "si" : "no" });
  } else if (question.type === "escala") {
    const { min, max } = numericRange(question) as { min: number; max: number };
    const n = digit === 0 && max >= 10 ? 10 : digit;
    if (n >= min && n <= max) actions.onPick({ number: n });
  } else if (question.type === "opcion_multiple" && digit >= 1 && digit <= question.options.length) {
    const result = toggleOption(question, value?.optionIds ?? [], question.options[digit - 1].id);
    if (result.limit) actions.onLimit?.(result.limit);
    else actions.onChange(result.value);
  }
}
