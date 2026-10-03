"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createInvoiceAction, type ActionState } from "../../actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function InvoiceForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createInvoiceAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Organización">
        <Select name="organization_id" required defaultValue="">
          <option value="" disabled>
            Elegí una organización
          </option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Número de comprobante">
          <Input name="number" required placeholder="FC-0001-00001234" autoFocus />
        </Field>
        <Field label="Monto" hint="En la moneda indicada">
          <Input name="amount" type="number" min="0" step="0.01" required placeholder="850000" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Moneda">
          <Select name="currency" defaultValue="ARS">
            <option value="ARS">ARS — Peso argentino</option>
            <option value="USD">USD — Dólar estadounidense</option>
          </Select>
        </Field>
        <Field label="Vencimiento" hint="Opcional">
          <Input name="due_at" type="date" />
        </Field>
      </div>

      <Field label="Concepto">
        <Input name="concept" required placeholder="Monitor de Opinión Pública 2026 — Ola 3" />
      </Field>

      <Field label="Notas internas" hint="Solo visibles para la administración central.">
        <Textarea name="notes" placeholder="Forma de pago, referencia, contacto de facturación…" />
      </Field>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pendingLabel="Creando…">Crear factura</SubmitButton>
        <Link
          href="/admin/facturacion"
          className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
