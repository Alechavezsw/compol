import type { Metadata } from "next";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requireOrganization } from "@/lib/auth";
import type { UserRole } from "@/lib/types";
import { isDemoMode } from "@/lib/demo/mode";
import { DemoBanner } from "@/components/demo-banner";
import Link from "next/link";

// Estas areas dependen de la sesion: nunca deben prerenderizarse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/cliente", label: "Resumen", icon: "dashboard", exact: true },
  { href: "/cliente/proyectos", label: "Proyectos", icon: "projects" },
  { href: "/cliente/encuestas", label: "Encuestas", icon: "surveys" },
  { href: "/cliente/informes", label: "Biblioteca", icon: "ai" },
  { href: "/cliente/redes", label: "Radar de conversación", icon: "social" },
  { href: "/cliente/equipo", label: "Equipo", icon: "users" },
];

const POLITICO_NAV: NavItem[] = [
  { href: "/cliente", label: "Pantallazo", icon: "dashboard", exact: true },
  { href: "/cliente/encuestas", label: "En vivo", icon: "surveys" },
  { href: "/cliente/informes", label: "Informes", icon: "ai" },
];

function navFor(role: UserRole) {
  if (role === "politico") return POLITICO_NAV;
  if (role === "super_admin") {
    return [...NAV, { href: "/cliente/dirigentes", label: "Dirigentes", icon: "leaders" as const }];
  }
  return NAV;
}

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { profile, organization } = await requireOrganization(["org_admin", "org_analyst", "politico"]);

  return (
    <AppShell
      nav={navFor(profile.role)}
      banner={
        <>
          {isDemoMode() ? <DemoBanner /> : null}
          {profile.role === "super_admin" ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
              <p>
                Operando <strong>{organization.name}</strong>. Cargá las encuestas y generá los informes
                acá: el político de esta organización los ve con su usuario.
              </p>
              <Link href="/admin/organizaciones" className="font-medium text-[var(--primary)]">
                Volver a administración
              </Link>
            </div>
          ) : null}
        </>
      }
      areaLabel={profile.role === "super_admin" ? "Operación del cliente" : "Panel del cliente"}
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
