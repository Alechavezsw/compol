import type { Metadata } from "next";
import { AppShell, type NavItem } from "@/components/app-shell";
import { isClientReadOnly, requireOrganization } from "@/lib/auth";
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
  { href: "/cliente/informes", label: "Biblioteca", icon: "ai" },
  { href: "/cliente/redes", label: "Radar de conversación", icon: "social" },
  { href: "/cliente/equipo", label: "Equipo", icon: "users" },
];

/** Político: solo lectura política (tablero, resultados, radar, biblioteca). */
const NAV_POLITICO: NavItem[] = [
  { href: "/cliente", label: "Resumen", icon: "dashboard", exact: true },
  { href: "/cliente/encuestas", label: "Encuestas", icon: "surveys" },
  { href: "/cliente/informes", label: "Biblioteca", icon: "ai" },
  { href: "/cliente/redes", label: "Radar de conversación", icon: "social" },
];

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
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
