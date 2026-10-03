"use client";

import { useActionState } from "react";
import { createMedicionAction } from "../../actions";
import type { ActionState } from "../../actions";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function MedicionForm({
  dirigenteId,
  projects,
}: {
  dirigenteId: string;
  projects: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createMedicionAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="dirigente_id" value={dirigenteId} />

      <div className="grid grid-cols-3 gap-3">
        <Field label="Conoc. %">
          <Input name="conocimiento" type="number" min={0} max={100} step="0.1" placeholder="88" />
        </Field>
        <Field label="Imagen + %">
          <Input name="imagen_positiva" type="number" min={0} max={100} step="0.1" placeholder="41" />
        </Field>
        <Field label="Imagen − %">
          <Input name="imagen_negativa" type="number" min={0} max={100} step="0.1" placeholder="33" />
        </Field>
      </div>

      {projects.length ? (
        <Field label="Proyecto" hint="Opcional: la ola que generó esta medición.">
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

      <Field label="Segmento" hint="Opcional">
        <Input name="segmento" placeholder="Total municipio" />
      </Field>

      <Field label="Fecha de medición" hint="Vacío usa la fecha de hoy.">
        <Input name="measured_at" type="date" />
      </Field>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}

      <SubmitButton pendingLabel="Guardando…" className="w-full">
        Cargar medición
      </SubmitButton>
    </form>
  );
}
