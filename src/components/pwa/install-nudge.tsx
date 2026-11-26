"use client";

import { X } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { dismissInstallNudge, useInstallState } from "./install-store";
import { InstallButton } from "./install-button";

/**
 * Invitación a instalar, solo en el celular y solo si todavía no se instaló.
 * Se puede cerrar: vuelve a aparecer en dos semanas.
 */
export function InstallNudge({ message }: { message?: string }) {
  const state = useInstallState();
  if (!state.ready || state.standalone || state.nudgeDismissed) return null;
  if (state.platform === "desktop") return null;

  return (
    <div className="print-hidden relative mb-5 flex items-center gap-3 overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--primary)_22%,var(--border))] bg-[linear-gradient(135deg,var(--primary-soft),var(--surface)_75%)] p-3.5 pr-10 shadow-[var(--shadow-card)] animate-rise lg:hidden">
      <LogoMark className="size-11 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--foreground)]">Instalá Consulta en tu celular</p>
        <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
          {message ?? "Se abre a pantalla completa, como una app."}
        </p>
        <InstallButton
          size="sm"
          label={state.canPrompt ? "Instalar" : "Cómo instalarla"}
          className="mt-2.5"
        />
      </div>
      <button
        type="button"
        onClick={dismissInstallNudge}
        aria-label="Ahora no"
        className="absolute top-2 right-2 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
