"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createDirigenteAction } from "../../actions";
import type { ActionState } from "../../actions";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function DirigenteForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createDirigenteAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Nombre y apellido">
        <Input name="name" required placeholder="Ricardo Salvatierra" autoFocus />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Cargo" hint="Opcional">
          <Input name="role" placeholder="Intendente" />
        </Field>
        <Field label="Afiliación" hint="Opcional">
          <Input name="affiliation" placeholder="Frente Vecinal" />
        </Field>
      </div>

      <Field label="Notas internas" hint="Solo visibles para tu organización.">
        <Textarea name="notes" placeholder="Antecedentes, temas sensibles, contexto para el análisis…" />
      </Field>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pendingLabel="Creando…">Crear ficha</SubmitButton>
        <Link
          href="/cliente/dirigentes"
          className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
