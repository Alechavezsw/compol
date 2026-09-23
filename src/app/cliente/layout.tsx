import type { Metadata } from "next";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requireOrganization } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/mode";
import { DemoBanner } from "@/components/demo-banner";

// Estas areas dependen de la sesion: nunca deben prerenderizarse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
};

const NAV: NavItem[] = [
  { href: "/cliente", label: "Resumen", icon: "dashboard", exact: true },
  { href: "/cliente/encuestas", label: "Encuestas", icon: "surveys" },
  { href: "/cliente/informes", label: "Informes IA", icon: "ai" },
  { href: "/cliente/redes", label: "Humor en redes", icon: "social" },
  { href: "/cliente/equipo", label: "Equipo", icon: "users" },
];

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { profile, organization } = await requireOrganization(["org_admin", "org_analyst"]);

  return (
    <AppShell
      nav={NAV}
      banner={isDemoMode() ? <DemoBanner /> : null}
      areaLabel="Panel del cliente"
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
