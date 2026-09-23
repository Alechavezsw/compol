"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Plus, StopCircle } from "lucide-react";
import { addQuestionAction, type ActionState } from "../../actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
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

const TYPE_HINT: Record<QuestionType, string> = {
  opcion_unica: "Una sola respuesta. Ideal para evaluaciones y perfiles.",
  opcion_multiple: "Varias respuestas. Podés poner un tope de marcas.",
  escala: "Puntaje en una escala (1 a 10, 0 a 10, 1 a 5…).",
  numero: "Valor numérico con rango válido (edad, cantidad).",
  si_no: "Dos respuestas. Sirve como pregunta filtro.",
  texto_corto: "Respuesta breve escrita.",
  texto_largo: "Respuesta abierta; el tablero extrae términos frecuentes.",
  fecha: "Una fecha del calendario.",
};

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

export function QuestionForm({ surveyId, sources }: { surveyId: string; sources: BranchSource[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(addQuestionAction, {});
  const [type, setType] = useState<QuestionType>("opcion_unica");
  const [optionsText, setOptionsText] = useState("");
  const [branchOn, setBranchOn] = useState("");
  const [formKey, setFormKey] = useState(0);
  const lastOk = useRef<string | null>(null);

  // Tras agregar una pregunta, el formulario vuelve a cero para cargar la siguiente.
  useEffect(() => {
    if (state.ok && state.ok !== lastOk.current) {
      lastOk.current = state.ok;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio del formulario tras una acción exitosa
      setOptionsText("");
      setBranchOn("");
      setFormKey((k) => k + 1);
    }
  }, [state.ok]);

  const options = useMemo(() => optionsText.split("\n").map((o) => o.trim()).filter(Boolean), [optionsText]);
  const source = sources.find((s) => s.id === branchOn);
  const exclusives = type === "opcion_multiple" ? options.filter(looksExclusive) : [];

  return (
    <form key={formKey} action={formAction} className="space-y-4">
      <input type="hidden" name="survey_id" value={surveyId} />

      <Field label="Enunciado">
        <Textarea
          name="text"
          required
          minLength={3}
          maxLength={500}
          rows={2}
          className="min-h-16"
          placeholder="¿Cómo evalúa la gestión del gobierno municipal?"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de respuesta" hint={TYPE_HINT[type]}>
          <Select name="type" value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
            {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Sección" hint="Agrupa preguntas. Usá «Perfil» para edad, género, etc.: el tablero las usa para los cruces.">
          <Input name="section" placeholder="Perfil, Gestión, Agenda…" list="secciones-comunes" />
          <datalist id="secciones-comunes">
            {["Filtro", "Perfil", "Gestión", "Agenda", "Servicios", "Medios", "Abierta"].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
      </div>

      {WITH_OPTIONS.includes(type) ? (
        <Field
          label={`Opciones${options.length ? ` (${options.length})` : ""}`}
          hint="Una por línea, en el orden en que se leen. «No sabe / No contesta» y «Ninguno» se vuelven excluyentes solas."
        >
          <Textarea
            name="options"
            rows={5}
            required
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={"Muy buena\nBuena\nRegular\nMala\nMuy mala\nNo sabe / No contesta"}
          />
        </Field>
      ) : null}

      {type === "opcion_multiple" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tope de opciones" hint="Vacío = sin tope.">
            <Input name="max_choices" type="number" min={1} max={Math.max(1, options.length - 1)} placeholder="3" />
          </Field>
          {exclusives.length ? (
            <p className="self-center rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
              Excluyentes: <strong className="text-[var(--foreground)]">{exclusives.join(", ")}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {type === "escala" || type === "numero" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor mínimo" hint={type === "numero" ? "Opcional" : undefined}>
            <Input name="min_value" type="number" defaultValue={type === "escala" ? 1 : undefined} />
          </Field>
          <Field label="Valor máximo" hint={type === "numero" ? "Opcional" : undefined}>
            <Input name="max_value" type="number" defaultValue={type === "escala" ? 10 : undefined} />
          </Field>
        </div>
      ) : null}

      <Field label="Aclaración" hint="Opcional. Se muestra debajo del enunciado.">
        <Input name="help_text" placeholder="Leer las opciones en voz alta." maxLength={300} />
      </Field>

      {/* ------------------------------------------------------------ lógica */}
      <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] open:bg-[var(--surface)]" open={Boolean(branchOn)}>
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

          {type === "si_no" || (type === "opcion_unica" && options.length >= 2) ? (
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
                  options.map((o, i) => <Chip key={`${o}-${i}`} name="end_if_values" value={`o${i + 1}`} label={o} tone="warning" />)
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                La entrevista se guarda como descartada: suma a la incidencia, no a los resultados.
              </p>
            </div>
          ) : null}
        </div>
      </details>

      <label className="flex items-center gap-2.5 text-sm text-[var(--foreground)]">
        <input type="checkbox" name="is_required" defaultChecked className="size-4 rounded border-[var(--border)] accent-[var(--primary)]" />
        Respuesta obligatoria
      </label>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}

      <SubmitButton pendingLabel="Agregando…" className="w-full sm:w-auto">
        <Plus />
        Agregar pregunta
      </SubmitButton>
    </form>
  );
}
