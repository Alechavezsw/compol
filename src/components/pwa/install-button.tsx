"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { promptInstall, useInstallState } from "./install-store";
import { InstallSteps } from "./install-steps";

type Props = {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "outline" | "ghost";
  className?: string;
  /** Qué mostrar si la app ya corre instalada. Por defecto, nada. */
  installedFallback?: React.ReactNode;
};

/**
 * "Instalar la app". En Android y Chrome/Edge abre el diálogo nativo; en
 * iPhone (y donde no hay diálogo) abre una hoja con los pasos exactos.
 */
export function InstallButton({
  label = "Instalar la app",
  size = "md",
  variant = "primary",
  className,
  installedFallback = null,
}: Props) {
  const state = useInstallState();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  if (state.ready && state.standalone) return <>{installedFallback}</>;

  async function onClick() {
    if (state.canPrompt) {
      setBusy(true);
      try {
        await promptInstall();
      } finally {
        setBusy(false);
      }
      return;
    }
    setSheet(true);
  }

  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} onClick={onClick} disabled={busy}>
        <Download />
        {label}
      </Button>
      {sheet ? <InstallSheet onClose={() => setSheet(false)} /> : null}
    </>
  );
}

export function InstallSheet({ onClose }: { onClose: () => void }) {
  const state = useInstallState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="instalar-titulo">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        className={cn(
          "relative w-full max-w-md rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-rise",
          "pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-[28px] sm:pb-6",
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--primary)] uppercase">Instalar Consulta</p>
            <h2 id="instalar-titulo" className="display mt-1 text-[26px] leading-tight text-[var(--foreground)]">
              Tenela a un toque
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Se abre a pantalla completa, sin la barra del navegador, y las encuestas de campo funcionan sin señal.
        </p>
        <div className="mt-5">
          <InstallSteps platform={state.platform} compact />
        </div>
        {state.installedBefore ? (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--success-soft)] px-3.5 py-2.5 text-sm text-[var(--success)]">
            <CheckCircle2 className="size-4 shrink-0" />
            Ya la instalaste en este dispositivo: buscala entre tus apps.
          </p>
        ) : null}
        <Button type="button" variant="outline" className="mt-6 w-full" onClick={onClose}>
          Entendido
        </Button>
      </div>
    </div>,
    document.body,
  );
}
