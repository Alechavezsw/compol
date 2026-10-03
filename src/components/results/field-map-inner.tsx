"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Play } from "lucide-react";
import { CASE_TONE, CASE_TONE_ORDER, type CaseTone } from "@/lib/case-tone";
import { formatDateTime } from "@/lib/utils";

export type FieldMapPoint = {
  id: string;
  lat: number;
  lng: number;
  zone: string | null;
  channel: "campo" | "web";
  submittedAt: string | null;
  tone: CaseTone;
  toneLabel: string | null;
};

function FitBounds({ points }: { points: FieldMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [36, 36], maxZoom: 14 },
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
  const center: [number, number] = sorted.length ? [sorted[0].lat, sorted[0].lng] : [-31.5375, -68.5364];
  const present = CASE_TONE_ORDER.filter((key) => sorted.some((p) => p.tone === key));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070b14] shadow-[0_28px_70px_-32px_rgba(15,23,42,0.65)]">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="field-map h-[460px] w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds points={sorted} />
        {visible.map((p) => {
          const tone = CASE_TONE[p.tone];
          const fresh = justAdded.has(p.id);
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={fresh ? 10 : 7}
              pathOptions={{
                color: "#041016",
                fillColor: tone.color,
                fillOpacity: 0.92,
                weight: 1.5,
                className: fresh ? "field-map-marker-new" : undefined,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} className="field-map-tip">
                <span className="block text-[11px] font-semibold" style={{ color: tone.color }}>
                  {p.toneLabel ?? tone.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-300">
                  {p.zone ?? "Web"} · {p.submittedAt ? formatDateTime(p.submittedAt) : "—"}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#070b14]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#070b14]/80 to-transparent" />

      <button
        type="button"
        onClick={replay}
        className="absolute top-3 right-3 z-[1000] inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#070b14]/90 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm backdrop-blur transition-colors hover:bg-white/10"
      >
        <Play className="size-3.5" />
        Reproducir carga
      </button>

      <div className="absolute bottom-3 left-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-[#070b14]/90 px-3 py-2 text-[11px] backdrop-blur">
        {present.map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 text-slate-200">
            <span className="size-2 rounded-full" style={{ background: CASE_TONE[key].color }} />
            {CASE_TONE[key].label}
          </span>
        ))}
        <span className="ml-1 text-slate-400">
          {shown}/{sorted.length} casos
          {justAdded.size ? ` · +${justAdded.size} nuevo${justAdded.size > 1 ? "s" : ""}` : ""}
        </span>
      </div>
    </div>
  );
}
