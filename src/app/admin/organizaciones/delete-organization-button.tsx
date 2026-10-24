"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteOrganizationAction, type ActionState } from "../actions";
import { FormMessage } from "@/components/ui/field";

export function DeleteOrganizationButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteOrganizationAction, {});

  return (
    <form
      action={formAction}
      className="space-y-1"
      onSubmit={(e) => {
        const ok = window.confirm(
          `¿Eliminar «${name}»?\n\nSe borran sus encuestas, respuestas, informes y radar. Los usuarios de esa organización quedan sin cliente asignado.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={`Eliminar ${name}`}
        className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
      >
        <Trash2 className="size-3.5" />
        Eliminar
      </button>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
    </form>
  );
}
