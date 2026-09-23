import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Acceso denegado" };

const MOTIVOS: Record<string, { title: string; text: string }> = {
  rol: {
    title: "Esta sección no corresponde a tu rol",
    text: "Tu usuario no tiene permisos sobre esta área de la plataforma. Si creés que es un error, pedile a la administración que revise tu rol.",
  },
  inactivo: {
    title: "Tu usuario está desactivado",
    text: "Un administrador dio de baja este acceso. Contactá a la administración de tu organización para reactivarlo.",
  },
  "sin-organizacion": {
    title: "Todavía no tenés una organización asignada",
    text: "Tu usuario existe pero no está vinculado a ningún cliente. La administración central tiene que asignarte una organización.",
  },
};

export default async function AccesoDenegadoPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; destino?: string }>;
}) {
  const { motivo, destino } = await searchParams;
  const info = MOTIVOS[motivo ?? ""] ?? {
    title: "No podés acceder a esta sección",
    text: "El recurso no existe o no tenés permiso para verlo.",
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] p-8 text-center shadow-[var(--shadow-card)] backdrop-blur">
        <div className="mb-8 flex justify-center">
          <Logo href="/inicio" />
        </div>

        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
          <ShieldAlert className="size-6" />
        </span>

        <h1 className="display mt-5 text-3xl text-[var(--foreground)]">
          {info.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{info.text}</p>

        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <ButtonLink href={destino && destino.startsWith("/") ? destino : "/inicio"}>
            Ir a mi panel
          </ButtonLink>
          <form action="/auth/salir" method="post">
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] sm:w-auto"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
