"use client";

import { useActionState, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { updateQuestionAction, type ActionState } from "../../actions";
import { FormMessage, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

/** Edición en el lugar de lo que no cambia la estructura: textos y obligatoriedad. */
export function QuestionEditor({
  surveyId,
  question,
}: {
  surveyId: string;
  question: { id: string; text: string; help_text: string | null; section: string | null; is_required: boolean; isFilter: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await updateQuestionAction(prev, fd);
    if (result.ok) setOpen(false);
    return result;
  }, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Editar pregunta"
        className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--primary)]"
      >
        <Pencil className="size-4" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
      <form
        action={formAction}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl animate-rise"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--foreground)]">Editar pregunta</p>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-2)]" aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>
        <input type="hidden" name="id" value={question.id} />
        <input type="hidden" name="survey_id" value={surveyId} />
        <Textarea name="text" defaultValue={question.text} rows={3} required minLength={3} maxLength={500} />
        <Input name="help_text" defaultValue={question.help_text ?? ""} placeholder="Aclaración (opcional)" maxLength={300} />
        <Input name="section" defaultValue={question.section ?? ""} placeholder="Sección" maxLength={60} />
        <label className="flex items-center gap-2.5 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            name="is_required"
            defaultChecked={question.is_required}
            disabled={question.isFilter}
            className="size-4 accent-[var(--primary)]"
          />
          Obligatoria {question.isFilter ? <span className="text-xs text-[var(--muted)]">(las preguntas filtro siempre lo son)</span> : null}
        </label>
        <p className="text-xs text-[var(--muted)]">
          El tipo y las opciones no se editan para no romper la comparabilidad de las respuestas ya cargadas.
        </p>
        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        <SubmitButton pendingLabel="Guardando…" size="sm">
          <Check />
          Guardar
        </SubmitButton>
      </form>
    </div>
  );
}
