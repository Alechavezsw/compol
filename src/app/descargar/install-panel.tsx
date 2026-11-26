"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { InstallButton } from "@/components/pwa/install-button";
import { useInstallState } from "@/components/pwa/install-store";
import { InstallSteps } from "@/components/pwa/install-steps";

/** Botón principal + los pasos de la plataforma en la que se está mirando. */
export function InstallPanel() {
  const state = useInstallState();

  if (state.ready && state.standalone) {
    return (
      <div className="rounded-2xl border border-[color-mix(in_oklab,var(--success)_30%,var(--border))] bg-[var(--success-soft)] p-5">
        <p className="flex items-center gap-2 font-semibold text-[var(--success)]">
          <CheckCircle2 className="size-5" />
          Ya estás usando la app instalada
        </p>
        <ButtonLink href="/inicio" className="mt-4 w-full">
          Ir a mi panel
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <InstallButton
        size="lg"
        className="h-14 w-full text-base"
        label={state.canPrompt ? "Instalar Consulta" : "Ver cómo instalarla"}
      />
      {state.ready && !state.canPrompt ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <InstallSteps platform={state.platform} />
        </div>
      ) : null}
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: "Instalá Consulta", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* cancelado o sin permiso: no pasa nada */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-left transition-colors hover:border-[color-mix(in_oklab,var(--primary)_30%,var(--border))]"
    >
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-[var(--foreground)]">{url}</span>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--primary)]">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copiado" : "Compartir"}
      </span>
    </button>
  );
}
