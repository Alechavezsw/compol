import type { Metadata } from "next";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/mode";
import { DemoBanner } from "@/components/demo-banner";

// Estas areas dependen de la sesion: nunca deben prerenderizarse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "Administración", template: "%s · Administración" } };

const NAV: NavItem[] = [
  { href: "/admin", label: "Panel general", icon: "dashboard", exact: true },
  { href: "/admin/organizaciones", label: "Organizaciones", icon: "orgs" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "users" },
  { href: "/admin/encuestadores", label: "Encuestadores", icon: "field" },
  { href: "/admin/encuestas", label: "Encuestas", icon: "surveys" },
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
