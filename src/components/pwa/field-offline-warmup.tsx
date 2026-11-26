"use client";

import { useEffect, useState } from "react";
import { CloudCheck } from "lucide-react";

/**
 * Pide al service worker que deje guardadas las pantallas de campo de las
 * encuestas asignadas, así el encuestador puede abrirlas aunque salga sin señal
 * y todavía no las haya tocado.
 */
export function FieldOfflineWarmup({ urls }: { urls: string[] }) {
  const [saved, setSaved] = useState<number | null>(null);
  const key = urls.join("|");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.onLine || !key) return;
    let cancelled = false;
    const list = key.split("|");

    navigator.serviceWorker.ready
      .then((registration) => {
        const worker = registration.active;
        if (!worker || cancelled) return;
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          if (!cancelled && event.data?.type === "warmed") setSaved(event.data.saved as number);
        };
        worker.postMessage({ type: "warm-field", urls: list }, [channel.port2]);
      })
      .catch(() => {
        /* sin service worker: se sigue usando con señal */
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  // `/campo` también se guarda; al encuestador le importan las encuestas.
  const surveys = saved == null ? 0 : Math.max(0, saved - 1);
  if (!surveys) return null;

  return (
    <p className="flex items-center gap-2 text-xs text-[var(--success)]">
      <CloudCheck className="size-4 shrink-0" />
      {surveys === 1
        ? "Tu encuesta quedó guardada en el teléfono: la podés abrir sin señal."
        : `Tus ${surveys} encuestas quedaron guardadas en el teléfono: las podés abrir sin señal.`}
    </p>
  );
}
