"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { generateReportAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { REPORT_KIND_LABEL, type ReportKind } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

const KIND_HINT: Record<ReportKind, string> = {
  ejecutivo: "Lectura general y decisiones, para la máxima autoridad.",
  tecnico: "Ficha metodológica y análisis pregunta por pregunta.",
  comunicacional: "Titulares, datos para placas y qué no se puede afirmar.",
  comparativo: "Contraste entre zonas y segmentos disponibles.",
};

function GenerateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="space-y-2">
      <Button type="submit" size="lg" className="w-full" disabled={pending || disabled}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" />
            Analizando los datos…
          </>
        ) : (
          <>
            <Sparkles />
            Generar informe
          </>
        )}
      </Button>
      {pending ? (
        <p className="text-center text-xs text-[var(--muted)]">
          El modelo está leyendo los agregados del relevamiento. Puede demorar hasta un minuto.
        </p>
      ) : null}
    </div>
  );
}

/**
 * gemini  = hay clave, redacta el modelo
 * local   = sin clave pero en demo, se usa la plantilla local
 * missing = sin clave y sin demo, no se puede generar
 */
export type WriterMode = "gemini" | "local" | "missing";

export function ReportForm({
  surveys,
  defaultSurveyId,
  writer,
}: {
  surveys: { id: string; title: string; completed: number }[];
  defaultSurveyId?: string;
  writer: WriterMode;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(generateReportAction, {});

  const eligible = surveys.filter((s) => s.completed >= 10);

  return (
    <form action={formAction} className="space-y-5">
      {writer === "missing" ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning)]">
          <strong className="font-semibold">Falta la clave de Gemini.</strong> Cargala como secreto
          de la función <code className="font-mono">ai</code> en Supabase.
        </div>
      ) : null}

      {writer === "local" ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
          <strong className="font-semibold text-[var(--foreground)]">Sin clave de Gemini.</strong>{" "}
          El informe se arma con una plantilla local sobre las mismas cifras agregadas. Sirve para
          ver el formato; el análisis interpretativo lo aporta el modelo.
        </div>
      ) : null}

      <Field
        label="Encuesta"
        hint="Solo aparecen las que tienen al menos 10 casos completados."
      >
        <Select name="survey_id" required defaultValue={defaultSurveyId ?? ""}>
          <option value="" disabled>
            Elegir encuesta…
          </option>
          {eligible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {formatNumber(s.completed)} casos
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Tipo de informe">
        <Select name="kind" defaultValue="ejecutivo">
          {(Object.keys(REPORT_KIND_LABEL) as ReportKind[]).map((k) => (
            <option key={k} value={k}>
              {REPORT_KIND_LABEL[k]} — {KIND_HINT[k]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Audiencia" hint="Opcional. A quién va dirigido el documento.">
        <Input name="audience" placeholder="Intendencia y gabinete municipal" />
      </Field>

      <Field
        label="Foco del análisis"
        hint="Opcional. Qué querés que el informe mire con más detalle."
      >
        <Textarea
          name="focus"
          rows={3}
          placeholder="Prestar especial atención a la agenda de seguridad y a las diferencias entre zonas."
        />
      </Field>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <p className="text-xs leading-relaxed text-[var(--muted)]">
        El documento incluye tapa fotográfica, gráficos de los agregados y descarga en PDF.
      </p>

      <GenerateButton disabled={writer === "missing" || eligible.length === 0} />

      {eligible.length === 0 ? (
        <p className="text-center text-xs text-[var(--muted)]">
          Ninguna de tus encuestas llegó todavía a 10 casos completados.
        </p>
      ) : null}
    </form>
  );
}
