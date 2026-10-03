"use client";

import dynamic from "next/dynamic";
import type { FieldMapPoint } from "./field-map-inner";

const FieldMapInner = dynamic(() => import("./field-map-inner").then((m) => m.FieldMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--muted)]">
      Cargando mapa…
    </div>
  ),
});

export function FieldMap({ points }: { points: FieldMapPoint[] }) {
  return <FieldMapInner points={points} />;
}

export type { FieldMapPoint };
