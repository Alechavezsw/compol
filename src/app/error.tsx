"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";

/**
 * Pantalla para errores inesperados en cualquier ruta. En producción el mensaje
 * original no llega al navegador: queda el `digest` para buscarlo en los logs.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] p-8 text-center shadow-[var(--shadow-card)] backdrop-blur">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--warning-soft)] text-[var(--warning)]">
          <TriangleAlert className="size-6" />
        </span>

        <h1 className="display mt-5 text-3xl text-balance text-[var(--foreground)]">No pudimos cargar esta pantalla</h1>
        <p className="mt-3 text-sm leading-relaxed text-pretty text-[var(--muted)]">
          Fue un problema de nuestro lado y tus datos no se perdieron. Probá de nuevo; si sigue pasando, avisale a la
          administración.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-[var(--muted)]">Código de referencia: {error.digest}</p>
        ) : null}

        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => retry()}>
            <RotateCw />
            Reintentar
          </Button>
          <ButtonLink href="/inicio" variant="outline">
            Ir a mi panel
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
