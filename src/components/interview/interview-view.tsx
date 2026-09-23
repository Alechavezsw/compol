"use client";

import { useEffect } from "react";
import { ArrowLeft, ArrowRight, CircleSlash, CornerDownLeft, Loader2, Pencil, Send } from "lucide-react";
import { QuestionInput, handleInterviewKey } from "@/components/interview/question-input";
import type { Interview } from "@/components/interview/use-interview";
import { describeAnswer, isAnswered } from "@/lib/survey-logic";
import { cn } from "@/lib/utils";

const ONE_TAP = new Set(["opcion_unica", "si_no", "escala"]);

/**
 * Pantallas comunes de una entrevista en curso: pregunta, revisión y cierre
 * por filtro. La cáscara (campo o web) decide qué hay antes y después.
 */
export function InterviewView<Extra>({
  interview,
  onSubmit,
  pending,
  variant = "campo",
  submitLabel,
}: {
  interview: Interview<Extra>;
  onSubmit: () => void;
  pending: boolean;
  variant?: "campo" | "web";
  submitLabel?: string;
}) {
  const { stage, current, path, cursor, values, error } = interview;
  const web = variant === "web";

  useEffect(() => {
    if (stage !== "question") return;
    const onKey = (e: KeyboardEvent) =>
      handleInterviewKey(e, current, current ? values[current.id] : undefined, {
        onChange: (v) => current && interview.setValue(current.id, v),
        onPick: (v) => current && interview.answerAndAdvance(current.id, v),
        next: interview.next,
        prev: interview.prev,
        onLimit: interview.setError,
      });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, current, values, interview]);

  // ------------------------------------------------------------- revisión
  if (stage === "review") {
    return (
      <div className="animate-rise space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--primary)] uppercase">Último paso</p>
          <h2 className={cn("display mt-1 text-[var(--foreground)]", web ? "text-2xl" : "text-3xl")}>
            {web ? "Revisá tus respuestas" : "Revisá la entrevista"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Tocá cualquier respuesta para corregirla antes de enviar.</p>
        </div>

        <ol className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {path.map((q, i) => {
            const answered = isAnswered(q, values[q.id]);
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => interview.goTo(q.id)}
                  className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span className="mt-0.5 w-6 shrink-0 font-mono text-xs font-semibold text-[var(--muted)]">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs leading-snug text-[var(--muted)]">{q.text}</span>
                    <span
                      className={cn(
                        "mt-0.5 block text-sm font-medium",
                        answered ? "text-[var(--foreground)]" : "text-[var(--muted)] italic",
                      )}
                    >
                      {answered ? describeAnswer(q, values[q.id]) : "Sin responder"}
                    </span>
                  </span>
                  <Pencil className="mt-1 size-3.5 shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </li>
            );
          })}
        </ol>

        {error ? <p className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-2.5 text-sm text-[var(--danger)]">{error}</p> : null}

        <div className="flex gap-3">
          <NavButton variant="outline" onClick={interview.prev} disabled={pending}>
            <ArrowLeft className="size-4" />
          </NavButton>
          <NavButton onClick={onSubmit} disabled={pending} className="flex-1">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {pending ? "Enviando…" : (submitLabel ?? "Enviar")}
          </NavButton>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------- cierre por filtro
  if (stage === "ended") {
    return (
      <div className="animate-rise space-y-4 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--warning-soft)] text-[var(--warning)]">
          <CircleSlash className="size-6" />
        </span>
        <div>
          <h2 className={cn("display text-[var(--foreground)]", web ? "text-2xl" : "text-3xl")}>
            {web ? "¡Gracias por tu tiempo!" : "La entrevista termina acá"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
            {web
              ? "Por tu respuesta, esta consulta no aplica a tu caso. Igual registramos tu participación."
              : "La respuesta a la pregunta filtro deja a esta persona fuera de la muestra. Se guarda como descartada: cuenta para la incidencia, no para los resultados."}
          </p>
        </div>
        {error ? <p className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-2.5 text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="flex gap-3">
          <NavButton variant="outline" onClick={interview.prev} disabled={pending}>
            <ArrowLeft className="size-4" />
            Corregir
          </NavButton>
          <NavButton onClick={onSubmit} disabled={pending} className="flex-1">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {web ? "Finalizar" : "Registrar y cerrar"}
          </NavButton>
        </div>
      </div>
    );
  }

  if (!current) return null;

  // ------------------------------------------------------------- pregunta
  const total = path.length;
  const oneTap = ONE_TAP.has(current.type);
  const prevSection = cursor > 0 ? path[cursor - 1]?.section : null;
  const newSection = current.section && current.section !== prevSection;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
          <span className="font-medium tabular-nums">
            {cursor + 1} <span className="opacity-60">de {total}</span>
          </span>
          {current.section ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 font-semibold tracking-wide",
                newSection ? "bg-[var(--primary)] text-[var(--primary-fg)]" : "bg-[var(--primary-soft)] text-[var(--primary)]",
              )}
            >
              {current.section}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex gap-1">
          {path.map((q, i) => (
            <span
              key={q.id}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                i < cursor ? "bg-[var(--primary)]" : i === cursor ? "bg-[color-mix(in_oklab,var(--primary)_55%,transparent)]" : "bg-[var(--surface-2)]",
              )}
            />
          ))}
        </div>
      </div>

      <div key={current.id} className="animate-rise">
        <h2
          className={cn(
            "leading-snug font-semibold tracking-tight text-balance text-[var(--foreground)]",
            web ? "text-xl" : "text-[22px]",
          )}
        >
          {current.text}
          {!current.is_required ? (
            <span className="ml-2 align-middle text-xs font-normal text-[var(--muted)]">(opcional)</span>
          ) : null}
        </h2>
        {current.help_text ? <p className="mt-2 text-sm text-[var(--muted)]">{current.help_text}</p> : null}

        <div className="mt-5">
          <QuestionInput
            question={current}
            value={values[current.id]}
            onChange={(v) => interview.setValue(current.id, v)}
            onPick={(v) => interview.answerAndAdvance(current.id, v)}
            onLimit={interview.setError}
            large={!web}
          />
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-[var(--danger-soft)] px-3.5 py-2.5 text-sm text-[var(--danger)] animate-rise">
            {error}
          </p>
        ) : null}
      </div>

      <div className={cn("flex gap-3", !web && "sticky bottom-0 -mx-4 bg-[color-mix(in_oklab,var(--background)_88%,transparent)] px-4 py-4 backdrop-blur sm:mx-0 sm:px-0")}>
        <NavButton variant="outline" onClick={interview.prev} disabled={cursor === 0} aria-label="Anterior">
          <ArrowLeft className="size-4" />
        </NavButton>
        <NavButton onClick={interview.next} className="flex-1">
          {oneTap && !isAnswered(current, values[current.id]) && !current.is_required ? "Saltear" : cursor === total - 1 ? "Revisar" : "Siguiente"}
          <ArrowRight className="size-4" />
        </NavButton>
      </div>

      {!web ? (
        <p className="hidden items-center justify-center gap-1.5 text-[11px] text-[var(--muted)] sm:flex">
          Atajos: números para elegir · <CornerDownLeft className="size-3" /> para avanzar · Esc para volver
        </p>
      ) : null}
    </div>
  );
}

function NavButton({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition-all disabled:pointer-events-none disabled:opacity-40 active:translate-y-px",
        variant === "primary"
          ? "bg-[var(--primary)] text-[var(--primary-fg)] shadow-[0_12px_26px_-14px_var(--primary)] hover:brightness-110"
          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)]",
        className,
      )}
      {...props}
    />
  );
}
