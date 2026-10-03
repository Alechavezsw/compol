"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Play } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export type FieldMapPoint = {
  id: string;
  lat: number;
  lng: number;
  zone: string | null;
  channel: "campo" | "web";
  submittedAt: string | null;
};

const CHANNEL_COLOR: Record<FieldMapPoint["channel"], string> = {
  campo: "#3d2de0",
  web: "#0d9488",
};

function FitBounds({ points }: { points: FieldMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [28, 28], maxZoom: 14 },
    );
    // Solo al montar: no queremos que la animación de carga vuelva a encuadrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

/**
 * Reproduce la carga de casos en el orden real en que se cargaron. La primera
 * vez hace el recorrido cronológico completo; si después llegan casos nuevos
 * (el operativo sigue en campo y la página se refresca sola) no repite todo
 * el recorrido: solo destaca los puntos que acaban de aparecer.
 */
export function FieldMapInner({ points }: { points: FieldMapPoint[] }) {
  const sorted = useMemo(
    () =>
      [...points].sort((a, b) => {
        const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return ta - tb;
      }),
    [points],
  );

  const [shown, setShown] = useState(0);
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const frame = useRef<number | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const popTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replay = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    seenIds.current = new Set(sorted.map((p) => p.id));
    setJustAdded(new Set());
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || sorted.length === 0) {
      setShown(sorted.length);
      return;
    }
    setShown(0);
    const duration = 3200;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setShown(Math.max(1, Math.round(progress * sorted.length)));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  // Primera carga: recorrido completo. Actualizaciones en vivo: solo destacar
  // lo nuevo, sin reiniciar el recorrido ni recentrar el mapa de golpe.
  useEffect(() => {
    if (seenIds.current.size === 0) {
      replay();
      return () => {
        if (frame.current) cancelAnimationFrame(frame.current);
      };
    }

    const added = sorted.filter((p) => !seenIds.current.has(p.id));
    seenIds.current = new Set(sorted.map((p) => p.id));
    setShown(sorted.length);

    if (added.length) {
      setJustAdded(new Set(added.map((p) => p.id)));
      if (popTimeout.current) clearTimeout(popTimeout.current);
      popTimeout.current = setTimeout(() => setJustAdded(new Set()), 2400);
    }

    return () => {
      if (popTimeout.current) clearTimeout(popTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted]);

  const visible = sorted.slice(0, shown);
  const center: [number, number] = sorted.length ? [sorted[0].lat, sorted[0].lng] : [-34.6177, -68.3301];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)]">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-[420px] w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds points={sorted} />
        {visible.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={5}
            pathOptions={{
              color: CHANNEL_COLOR[p.channel],
              fillColor: CHANNEL_COLOR[p.channel],
              fillOpacity: 0.75,
              weight: 1,
              className: justAdded.has(p.id) ? "field-map-marker-new" : undefined,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <span className="text-xs">
                {p.zone ?? "Web"} · {p.submittedAt ? formatDateTime(p.submittedAt) : "—"}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      <button
        type="button"
        onClick={replay}
        className="absolute top-3 right-3 z-[1000] inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-1.5 text-xs font-medium text-[var(--foreground)] shadow-sm backdrop-blur transition-colors hover:bg-[var(--surface-2)]"
      >
        <Play className="size-3.5" />
        Reproducir carga
      </button>

      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-1 text-[11px] font-medium text-[var(--muted)] backdrop-blur">
        {shown}/{sorted.length} casos
        {justAdded.size ? (
          <span className="inline-flex items-center gap-1 text-[var(--success)]">
            <span className="size-1.5 rounded-full bg-current animate-pulse-soft" />+{justAdded.size} nuevo
            {justAdded.size > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
