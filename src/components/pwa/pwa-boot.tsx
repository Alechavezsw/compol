"use client";

import { useEffect } from "react";

/**
 * Registra el service worker. En desarrollo queda apagado (pelea con la
 * recarga en caliente) salvo que se pida con NEXT_PUBLIC_SW_DEV=true.
 */
export function PwaBoot() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "true";
    if (!enabled) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          /* sin service worker la app sigue andando, solo que no sin señal */
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
