"use client";

import { useActionState } from "react";
import { updateOrganizationAction, type ActionState } from "../../actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { ColorPalette } from "@/components/color-palette";
import type { Organization } from "@/lib/types";

export function OrgEditForm({ org }: { org: Organization }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateOrganizationAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={org.id} />

      <Field label="Nombre">
        <Input name="name" required defaultValue={org.name} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select name="type" defaultValue={org.type}>
            <option value="gobierno">Gobierno</option>
            <option value="institucion">Institución</option>
            <option value="ong">ONG</option>
            <option value="privado">Privado</option>
          </Select>
        </Field>
        <Field label="Estado">
          <Select name="status" defaultValue={org.status}>
            <option value="activa">Activa</option>
            <option value="prueba">En prueba</option>
            <option value="suspendida">Suspendida</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Provincia o región">
          <Input name="region" defaultValue={org.region ?? ""} placeholder="San Juan" />
        </Field>
        <Field label="País">
          <Input name="country" defaultValue={org.country ?? "Argentina"} placeholder="Argentina" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Correo de contacto">
          <Input name="contact_email" type="email" defaultValue={org.contact_email ?? ""} />
        </Field>
        <Field label="Teléfono">
          <Input name="contact_phone" defaultValue={org.contact_phone ?? ""} />
        </Field>
      </div>

      <Field label="Color e identidad" hint="Se ve en el listado y en el perfil del cliente.">
        <ColorPalette name="brand_color" defaultValue={org.brand_color ?? ""} />
      </Field>

      <Field label="Notas internas" hint="Solo las ve la administración central.">
        <Textarea name="notes" defaultValue={org.notes ?? ""} rows={4} placeholder="Acuerdo, referentes, plazos…" />
      </Field>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}

      <SubmitButton pendingLabel="Guardando…">Guardar datos</SubmitButton>
    </form>
  );
}
