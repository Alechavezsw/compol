import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/demo/mode";
import { getDemoProfile } from "@/lib/demo/session";
import { demoTables } from "@/lib/demo/store";
import type { Organization, Profile, UserRole } from "@/lib/types";

export type SessionProfile = {
  user: User;
  profile: Profile;
  organization: Organization | null;
};

export { isSupabaseConfigured };

/** Ruta inicial segun el rol. */
export function homePathFor(role: UserRole) {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "org_admin":
    case "org_analyst":
      return "/cliente";
    case "surveyor":
      return "/campo";
  }
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  if (isDemoMode()) {
    const profile = await getDemoProfile();
    if (!profile) return null;

    const organization = profile.organization_id
      ? (demoTables().organizations.find((o) => o.id === profile.organization_id) ?? null)
      : null;

    // La demo no tiene Supabase Auth: sintetizamos el `user` mínimo que la app
    // usa (id y email) para no bifurcar el tipo de sesión.
    const user = {
      id: profile.id,
      email: profile.email ?? undefined,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: { full_name: profile.full_name },
      created_at: profile.created_at,
    } as User;

    return { user, profile, organization };
  }

  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  let organization: Organization | null = null;
  if (profile.organization_id) {
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .maybeSingle();
    organization = data ?? null;
  }

  return { user, profile, organization };
}

/** Exige sesion valida; si no hay, manda al login. */
export async function requireProfile(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!session.profile.is_active) redirect("/acceso-denegado?motivo=inactivo");
  return session;
}

/** Exige sesion y uno de los roles indicados. */
export async function requireRole(roles: UserRole[]): Promise<SessionProfile> {
  const session = await requireProfile();
  if (!roles.includes(session.profile.role)) {
    redirect(`/acceso-denegado?motivo=rol&destino=${homePathFor(session.profile.role)}`);
  }
  return session;
}

/** Los roles de cliente necesitan una organizacion asignada. */
export async function requireOrganization(roles: UserRole[]): Promise<
  SessionProfile & { organization: Organization }
> {
  const session = await requireRole(roles);
  if (!session.organization) {
    redirect("/acceso-denegado?motivo=sin-organizacion");
  }
  return session as SessionProfile & { organization: Organization };
}

export function canManage(role: UserRole) {
  return role === "super_admin" || role === "org_admin";
}
