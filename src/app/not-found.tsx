import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Página no encontrada", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] p-8 text-center shadow-[var(--shadow-card)] backdrop-blur">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <Compass className="size-6" />
        </span>

        <p className="mt-5 text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">Error 404</p>
        <h1 className="display mt-2 text-3xl text-balance text-[var(--foreground)]">No encontramos esa página</h1>
        <p className="mt-3 text-sm leading-relaxed text-pretty text-[var(--muted)]">
          El link puede estar mal escrito, o la encuesta ya no está disponible. Si llegaste desde un correo o un
          sitio web, pedí que te lo envíen de nuevo.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <ButtonLink href="/inicio">Ir a mi panel</ButtonLink>
          <ButtonLink href="/" variant="outline">
            Volver al inicio
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
