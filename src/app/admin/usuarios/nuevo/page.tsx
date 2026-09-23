import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { UserForm } from "./user-form";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/mode";
import type { UserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Nuevo usuario" };

const ROLES: UserRole[] = ["surveyor", "org_analyst", "org_admin", "super_admin"];

export default async function NuevoUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string; org?: string; volver?: string }>;
}) {
  const { rol, org, volver } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id, name").order("name");

  // En demo el cliente de administración es el falso: no hace falta la clave.
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) || isDemoMode();
  const role = ROLES.includes(rol as UserRole) ? (rol as UserRole) : "surveyor";

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <PageHeader
        title={role === "surveyor" ? "Nuevo encuestador" : "Nuevo usuario"}
        description={
          role === "surveyor"
            ? "Los encuestadores los da de alta y los asigna solo la administración central."
            : "El alta crea la cuenta de acceso y su perfil en la organización elegida."
        }
      />

      {!hasServiceKey ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning)]">
          <strong className="font-semibold">Falta la service role key.</strong> Para crear cuentas de acceso hay que
          cargar <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> en{" "}
          <code className="font-mono">.env.local</code>.
        </div>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <UserForm
            organizations={(data ?? []) as { id: string; name: string }[]}
            defaultRole={role}
            defaultOrganization={org ?? ""}
            returnTo={volver === "/admin/encuestadores" ? volver : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
