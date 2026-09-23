"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { createUserAction, type ActionState } from "../../actions";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import type { UserRole } from "@/lib/types";

function randomPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function UserForm({
  organizations,
  defaultRole = "surveyor",
  defaultOrganization = "",
  returnTo,
}: {
  organizations: { id: string; name: string }[];
  defaultRole?: UserRole;
  defaultOrganization?: string;
  returnTo?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createUserAction, {});
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [password, setPassword] = useState("");

  const needsOrg = role !== "super_admin";

  return (
    <form action={formAction} className="space-y-5">
      {returnTo ? <input type="hidden" name="volver" value={returnTo} /> : null}
      <Field label="Nombre y apellido">
        <Input name="full_name" required placeholder="Diego Ferreyra" autoFocus />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Correo">
          <Input name="email" type="email" required placeholder="persona@organismo.gob.ar" />
        </Field>
        <Field label="Teléfono" hint="Opcional">
          <Input name="phone" placeholder="+54 9 260 400 0000" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Rol">
          <Select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="surveyor">Encuestador</option>
            <option value="org_analyst">Analista del cliente</option>
            <option value="org_admin">Administrador del cliente</option>
            <option value="super_admin">Administración central</option>
          </Select>
        </Field>

        <Field
          label="Organización"
          hint={needsOrg ? undefined : "La administración central no pertenece a un cliente."}
        >
          <Select name="organization_id" required={needsOrg} disabled={!needsOrg} defaultValue={defaultOrganization}>
            <option value="" disabled>
              Elegir organización…
            </option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Contraseña inicial"
        hint="Mínimo 8 caracteres. Entregásela a la persona por un canal seguro."
      >
        <div className="flex gap-2">
          <Input
            name="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="font-mono"
          />
          <button
            type="button"
            onClick={() => setPassword(randomPassword())}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <RefreshCw className="size-3.5" />
            Generar
          </button>
        </div>
      </Field>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pendingLabel="Creando…">Crear usuario</SubmitButton>
        <Link
          href={returnTo ?? "/admin/usuarios"}
          className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
