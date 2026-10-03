"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProjectAction } from "../../actions";
import type { ActionState } from "../../actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { SERVICE_LINE_LABEL, type ServiceLine } from "@/lib/types";

const SERVICE_LINES = Object.keys(SERVICE_LINE_LABEL) as ServiceLine[];

export function ProyectoForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createProjectAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Nombre del proyecto">
        <Input name="name" required placeholder="Monitor de Opinión Pública 2027" autoFocus />
      </Field>

      <Field label="Línea de servicio">
        <Select name="service_line" defaultValue="opinion_publica">
          {SERVICE_LINES.map((line) => (
            <option key={line} value={line}>
              {SERVICE_LINE_LABEL[line]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Color" hint="Formato #RRGGBB, opcional">
          <Input name="color" placeholder="#0ea5a4" />
        </Field>
      </div>

      <Field label="Descripción" hint="Opcional">
        <Textarea name="description" placeholder="Serie trimestral de medición de percepción ciudadana…" />
      </Field>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pendingLabel="Creando…">Crear proyecto</SubmitButton>
        <Link
          href="/cliente/proyectos"
          className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
