"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteOrganizationAction, type ActionState } from "../actions";
import { FormMessage } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function DeleteOrganizationButton({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  size?: "sm" | "md";
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteOrganizationAction,
    {},
  );

  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-stretch gap-1"
      onSubmit={(e) => {
        const ok = window.confirm(
          `¿Eliminar «${name}»?\n\nSe borran sus encuestas, respuestas, informes y radar. Los usuarios de esa organización quedan sin cliente asignado.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="outline"
        size={size}
        disabled={pending}
        aria-label={`Eliminar ${name}`}
        className="border-[color-mix(in_oklab,var(--danger)_35%,var(--border))] text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[var(--danger-soft)]"
      >
        <Trash2 />
        {pending ? "Eliminando…" : "Eliminar"}
      </Button>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
    </form>
  );
}
