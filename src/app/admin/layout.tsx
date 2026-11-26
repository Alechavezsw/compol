import type { Metadata } from "next";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/mode";
import { DemoBanner } from "@/components/demo-banner";

// Estas areas dependen de la sesion: nunca deben prerenderizarse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Administración", template: "%s · Administración" },
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["super_admin"]);

  return (
    <AppShell
      nav={NAV}
      banner={isDemoMode() ? <DemoBanner /> : null}
      areaLabel="Administración central"
      user={{
        name: profile.full_name || "Administrador",
        email: profile.email,
        role: profile.role,
        avatarUrl: profile.avatar_url,
      }}
    >
      {children}
    </AppShell>
  );
}
