"use client";

import dynamic from "next/dynamic";

export const ZoneMap = dynamic(() => import("./zone-map-inner").then((m) => m.ZoneMapInner), {
  ssr: false,
  loading: () => <div className="h-[440px] w-full animate-pulse rounded-2xl bg-[#070b14] xl:h-[690px]" aria-label="Cargando mapa" />,
});

export type { MapZone, MapDot } from "./zone-map-inner";
