"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Building2, ClipboardList, LineChart, ShieldCheck } from "lucide-react";
import { signInDemoAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type UserRole } from "@/lib/types";

const ICONS: Record<UserRole, typeof ShieldCheck> = {
  super_admin: ShieldCheck,
  org_admin: Building2,
  org_analyst: LineChart,
  surveyor: ClipboardList,
};

function EnterButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending || disabled}>
      {pending ? "Entrando…" : "Entrar a la demo"}
      {!pending ? <ArrowRight /> : null}
    </Button>
  );
}

export function DemoLogin({
  users,
}: {
  users: { id: string; full_name: string; role: UserRole; description: string }[];
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(signInDemoAction, {});
  const [selected, setSelected] = useState<string>(users[1]?.id ?? users[0]?.id ?? "");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="user_id" value={selected} />

      <fieldset className="space-y-2">
        <legend className="sr-only">Elegí con qué rol entrar</legend>
        {users.map((u) => {
          const Icon = ICONS[u.role];
          const active = selected === u.id;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelected(u.id)}
              aria-pressed={active}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all",
                active
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-[0_10px_24px_-16px_color-mix(in_oklab,var(--primary)_80%,transparent)]"
                  : "border-[var(--border)] hover:bg-[var(--surface-2)] hover:border-[color-mix(in_oklab,var(--primary)_25%,var(--border))]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                  active
                    ? "bg-[var(--primary)] text-[var(--primary-fg)]"
                    : "bg-[var(--surface-2)] text-[var(--muted)]",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    active ? "text-[var(--primary)]" : "text-[var(--foreground)]",
                  )}
                >
                  {u.full_name}
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                    {ROLE_LABEL[u.role]}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">
                  {u.description}
                </span>
              </span>
            </button>
          );
        })}
      </fieldset>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <EnterButton disabled={!selected} />
    </form>
  );
}
