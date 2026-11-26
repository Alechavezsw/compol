import type { Metadata } from "next";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getSessionProfile, isClientReadOnly, requireOrganization, requireProfile } from "@/lib/auth";
import { CLIENT_ROLES } from "@/lib/types";
import { isDemoMode } from "@/lib/demo/mode";
import { DemoBanner } from "@/components/demo-banner";

// Estas areas dependen de la sesion: nunca deben prerenderizarse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

const NAV_FULL: NavItem[] = [
  { href: "/cliente", label: "Resumen", icon: "dashboard", exact: true },
  { href: "/cliente/proyectos", label: "Proyectos", icon: "projects" },
  { href: "/cliente/encuestas", label: "Encuestas", icon: "surveys" },
  { href: "/cliente/dirigentes", label: "Dirigentes", icon: "leaders" },
  { href: "/cliente/informes", label: "Biblioteca", icon: "ai" },
  { href: "/cliente/redes", label: "Radar de conversación", icon: "social" },
  { href: "/cliente/equipo", label: "Equipo", icon: "users" },
];

/** Político: solo lectura política (tablero, resultados, radar, biblioteca). */
const NAV_POLITICO: NavItem[] = [
  { href: "/cliente", label: "Resumen", icon: "dashboard", exact: true },
  { href: "/cliente/encuestas", label: "Encuestas", icon: "surveys" },
  { href: "/cliente/dirigentes", label: "Dirigentes", icon: "leaders" },
  { href: "/cliente/informes", label: "Biblioteca", icon: "ai" },
  { href: "/cliente/redes", label: "Radar de conversación", icon: "social" },
];

const NAV_ADMIN_VIEW: NavItem[] = [
  { href: "/admin", label: "Panel general", icon: "dashboard", exact: true, section: "Operación" },
  { href: "/admin/organizaciones", label: "Organizaciones", icon: "orgs", section: "Operación" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "users", section: "Operación" },
  { href: "/admin/encuestadores", label: "Encuestadores", icon: "field", section: "Operación" },
  { href: "/admin/proyectos", label: "Proyectos", icon: "projects", section: "Operación" },
  { href: "/admin/encuestas", label: "Encuestas", icon: "surveys", section: "Operación" },
  { href: "/admin/resultados", label: "Resultados", icon: "results", section: "Mediciones" },
  { href: "/cliente/informes", label: "Biblioteca", icon: "ai", section: "Mediciones" },
  { href: "/cliente/redes", label: "Radar", icon: "social", section: "Mediciones" },
  { href: "/cliente/dirigentes", label: "Dirigentes", icon: "leaders", section: "Mediciones" },
  { href: "/admin/facturacion", label: "Facturación", icon: "billing", section: "Administración" },
  { href: "/admin/contabilidad", label: "Contabilidad", icon: "accounting", section: "Administración" },
];

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  await requireProfile();

  // La administración central entra al panel del cliente solo para mirar
  // resultados / encuesta de un organismo (sin org propia).
  if (session?.profile.role === "super_admin") {
    return (
      <AppShell
        nav={NAV_ADMIN_VIEW}
        banner={isDemoMode() ? <DemoBanner /> : null}
        areaLabel="Vista de administración"
        orgName="Consulta · cliente"
        user={{
          name: session.profile.full_name || "Administrador",
          email: session.profile.email,
          role: session.profile.role,
          avatarUrl: session.profile.avatar_url,
        }}
      >
        {children}
      </AppShell>
    );
  }

  const { profile, organization } = await requireOrganization([...CLIENT_ROLES]);
  const readOnly = isClientReadOnly(profile.role);

  return (
    <AppShell
      nav={readOnly ? NAV_POLITICO : NAV_FULL}
      banner={isDemoMode() ? <DemoBanner /> : null}
      areaLabel={readOnly ? "Lectura política" : "Panel del cliente"}
      orgName={organization.name}
      user={{
        name: profile.full_name || "Usuario",
        email: profile.email,
        role: profile.role,
        avatarUrl: profile.avatar_url,
      }}
    >
      {children}
    </AppShell>
  );
}
