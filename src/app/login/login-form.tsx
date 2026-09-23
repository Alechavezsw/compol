"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";
import { signInAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Ingresando…" : "Ingresar"}
      {!pending ? <LogIn /> : null}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signInAction, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />

      <Field label="Correo institucional">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nombre@organismo.gob.ar"
          autoFocus
        />
      </Field>

      <Field label="Contraseña">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <SubmitButton />
    </form>
  );
}
