import type { Metadata } from "next";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/mode";
import { DemoBanner } from "@/components/demo-banner";

// Estas areas dependen de la sesion: nunca deben prerenderizarse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Campo", template: "%s · Campo" },
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/campo", label: "Mis asignaciones", icon: "field", exact: true },
];

export default async function CampoLayout({ children }: { children: React.ReactNode }) {
  const { profile, organization } = await requireRole(["surveyor"]);

  return (
    <AppShell
      nav={NAV}
      banner={isDemoMode() ? <DemoBanner /> : null}
      areaLabel="Trabajo de campo"
      offlineHint="Podés seguir cargando: las entrevistas quedan guardadas en el teléfono y se suben solas cuando vuelva la señal."
      installMessage="Instalala para abrir tus encuestas aunque no haya señal."
      orgName={organization?.name}
      user={{
        name: profile.full_name || "Encuestador",
        email: profile.email,
        role: profile.role,
        avatarUrl: profile.avatar_url,
      }}
    >
      {children}
    </AppShell>
  );
}
