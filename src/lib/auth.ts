import { cache } from "react";
import { cookies } from "next/headers";
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

/** Organización que la administración está operando. Los id de demo no son UUID. */
export const OPERATING_ORG_COOKIE = "compol_org";

export async function operatingOrganizationId() {
  const store = await cookies();
  const id = store.get(OPERATING_ORG_COOKIE)?.value ?? "";
  return /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id : null;
}

export async function setOperatingOrganization(id: string) {
  const store = await cookies();
  store.set(OPERATING_ORG_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

async function loadOrganization(id: string): Promise<Organization | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  return (data as Organization | null) ?? null;
}

/** Ruta inicial segun el rol. */
export function homePathFor(role: UserRole) {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "org_admin":
    case "org_analyst":
    case "politico":
      return "/cliente";
    case "surveyor":
      return "/campo";
  }
}

export const getSessionProfile = cache(async function getSessionProfile(): Promise<SessionProfile | null> {
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

  const { data } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;

  const { organizations, ...profile } = data as Profile & {
    organizations: Organization | Organization[] | null;
  };
  const organization = Array.isArray(organizations) ? organizations[0] ?? null : organizations;

  return { user, profile, organization };
});

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

/**
 * Área del cliente. La administración entra con la organización que eligió
 * operar; el resto necesita el rol y una organización en el perfil.
 */
export async function requireOrganization(roles: UserRole[]): Promise<
  SessionProfile & { organization: Organization }
> {
  const session = await requireProfile();
  if (session.profile.role === "super_admin") {
    const id = await operatingOrganizationId();
    if (!id) redirect("/admin/organizaciones");
    const organization = await loadOrganization(id);
    if (!organization) redirect("/admin/organizaciones");
    return { ...session, organization };
  }
  if (!roles.includes(session.profile.role)) {
    redirect(`/acceso-denegado?motivo=rol&destino=${homePathFor(session.profile.role)}`);
  }
  if (!session.organization) {
    redirect("/acceso-denegado?motivo=sin-organizacion");
  }
  return session as SessionProfile & { organization: Organization };
}

/** Escritura del operativo: solo la administración, sobre el cliente elegido. */
export async function requireOperator(): Promise<SessionProfile & { organization: Organization }> {
  const session = await requireProfile();
  if (session.profile.role !== "super_admin") {
    redirect(`/acceso-denegado?motivo=rol&destino=${homePathFor(session.profile.role)}`);
  }
  const id = await operatingOrganizationId();
  if (!id) redirect("/admin/organizaciones");
  const organization = await loadOrganization(id);
  if (!organization) redirect("/admin/organizaciones");
  return { ...session, organization };
}

/** Alta y edición de encuestas, informes, redes, proyectos y dirigentes. */
export function canManage(role: UserRole) {
  return role === "super_admin";
}
