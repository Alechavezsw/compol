"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createOrganizationAction, type ActionState } from "../../actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function OrgForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createOrganizationAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Nombre de la organización">
        <Input name="name" required placeholder="Municipalidad de San Juan" autoFocus />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tipo">
          <Select name="type" defaultValue="gobierno">
            <option value="gobierno">Gobierno</option>
            <option value="institucion">Institución</option>
            <option value="ong">ONG</option>
            <option value="privado">Privado</option>
          </Select>
        </Field>

        <Field label="Estado inicial">
          <Select name="status" defaultValue="prueba">
            <option value="prueba">En prueba</option>
            <option value="activa">Activa</option>
            <option value="suspendida">Suspendida</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Provincia o región" hint="Opcional">
          <Input name="region" placeholder="San Juan" />
        </Field>
        <Field label="Teléfono de contacto" hint="Opcional">
          <Input name="contact_phone" placeholder="+54 264 422 0000" />
        </Field>
      </div>

      <Field label="Correo de contacto" hint="A donde se envían las notificaciones institucionales.">
        <Input name="contact_email" type="email" placeholder="direccion@sanjuan.gob.ar" />
      </Field>

      <Field label="Notas internas" hint="Solo visibles para la administración central.">
        <Textarea name="notes" placeholder="Condiciones del acuerdo, referentes, plazos…" />
      </Field>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pendingLabel="Creando…">Crear organización</SubmitButton>
        <Link
          href="/admin/organizaciones"
          className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
