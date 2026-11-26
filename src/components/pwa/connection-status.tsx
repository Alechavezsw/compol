"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Franja que aparece solo mientras el teléfono no tiene conexión. */
export function ConnectionStatus({ hint }: { hint?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="print-hidden mb-5 flex items-start gap-2.5 rounded-2xl border border-[color-mix(in_oklab,var(--warning)_30%,var(--border))] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)] animate-rise"
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" />
      <p>
        <strong className="font-semibold">Sin conexión.</strong>{" "}
        {hint ?? "Lo que ya abriste sigue a mano; lo nuevo carga cuando vuelva la señal."}
      </p>
    </div>
  );
}
