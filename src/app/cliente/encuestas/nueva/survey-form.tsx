"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Globe, MapPin } from "lucide-react";
import { createSurveyAction, type ActionState } from "../../actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { GeographyFields } from "@/components/geography-fields";
import { SubmitButton } from "@/components/submit-button";
import { maxMarginOfError } from "@/lib/stats";
import { cn } from "@/lib/utils";

const METHODS = {
  campo: [
    "Presencial cara a cara, muestreo por cuotas",
    "Presencial en vía pública, muestreo aleatorio",
    "Telefónica asistida",
    "Mixta (presencial y telefónica)",
  ],
  web: ["Autoadministrada online (widget en sitio web y redes). Muestra no probabilística."],
  mixta: ["Mixta: presencial por cuotas y autoadministrada online"],
};

export function SurveyForm({
  surveys,
  projects,
}: {
  surveys: { id: string; title: string; questions: number }[];
  projects: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createSurveyAction, {});
  const [channel, setChannel] = useState<keyof typeof METHODS>("campo");
  const [target, setTarget] = useState(400);
  const moe = target > 0 ? maxMarginOfError(target) : null;

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Título del relevamiento">
        <Input name="title" required minLength={5} maxLength={160} autoFocus placeholder="Percepción Ciudadana — Ola 4 (Noviembre 2026)" />
      </Field>

      <Field label="Objetivo" hint="Se lo pasamos al motor de IA como contexto cuando redacta los informes.">
        <Textarea name="description" placeholder="Medir imagen de gestión, prioridades vecinales y satisfacción con servicios públicos." />
      </Field>

      {projects.length ? (
        <Field label="Proyecto" hint="Agrupa esta encuesta con otras olas de la misma línea de servicio.">
          <Select name="project_id" defaultValue="">
            <option value="">Sin proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="¿Cómo se va a responder?">
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["campo", "Campo", "Encuestadores con el celular", MapPin],
              ["web", "Web", "Link y widget en sitios", Globe],
              ["mixta", "Mixta", "Campo y web a la vez", Globe],
            ] as const
          ).map(([value, label, hint, Icon]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-2xl border p-3 transition-colors",
                channel === value ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-2)]",
              )}
            >
              <input type="radio" name="channel" value={value} checked={channel === value} onChange={() => setChannel(value)} className="sr-only" />
              <span className={cn("flex items-center gap-1.5 text-sm font-semibold", channel === value ? "text-[var(--primary)]" : "text-[var(--foreground)]")}>
                <Icon className="size-4" />
                {label}
              </span>
              <span className="text-xs text-[var(--muted)]">{hint}</span>
            </label>
          ))}
        </div>
        {channel !== "campo" ? <input type="hidden" name="web_enabled" value="on" /> : null}
      </Field>

      <GeographyFields />

      <Field
        label="Meta de casos"
        hint={moe ? `Margen de error máximo con esa muestra: ±${moe.toFixed(1).replace(".", ",")} pp al 95%.` : undefined}
      >
        <Input
          name="target_responses"
          type="number"
          min={1}
          max={100000}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          required
        />
      </Field>

      <Field label="Metodología">
        <Select key={channel} name="methodology" defaultValue={METHODS[channel][0]}>
          {METHODS[channel].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Inicio del campo" hint="Opcional">
          <Input name="starts_at" type="date" />
        </Field>
        <Field label="Cierre del campo" hint="Opcional. Se usa para proyectar si llegás a la meta.">
          <Input name="ends_at" type="date" />
        </Field>
      </div>

      {surveys.length ? (
        <Field label="Partir de un cuestionario existente" hint="Ideal para una nueva ola: copia preguntas, opciones y saltos.">
          <Select name="copy_from" defaultValue="">
            <option value="">Empezar con el cuestionario vacío</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.questions}>
                {s.title} ({s.questions} preguntas)
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pendingLabel="Creando…">Crear y armar el cuestionario</SubmitButton>
        <Link href="/cliente/encuestas" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
