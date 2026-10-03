"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca el Server Component de la página a intervalos mientras el
 * operativo está en campo, para que el tablero y el mapa reflejen casos
 * nuevos sin que alguien tenga que recargar a mano.
 */
export function LiveRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
