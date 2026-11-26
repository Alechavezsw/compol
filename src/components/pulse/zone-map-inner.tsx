"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapZone = {
  index: number;
  name: string;
  center: [number, number];
  /** Radio en píxeles: crece con la cantidad de casos. */
  radius: number;
  color: string;
  value: string;
  /** Menos casos que la base mínima: el dato se lee con cuidado. */
  few: boolean;
};

export type MapDot = { id: number; point: [number, number]; color: string };

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [56, 56], maxZoom: 13 });
    // Solo al montar: filtrar no tiene que mover el mapa bajo los dedos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

export function ZoneMapInner({
  zones,
  dots,
  selected,
  onSelect,
  compact = false,
}: {
  zones: MapZone[];
  /** Si viene, se dibujan los casos de a uno en lugar de las zonas. */
  dots: MapDot[] | null;
  selected: number | null;
  onSelect: (zone: number) => void;
  /** Altura fija más baja, para cuando va al lado de poco contenido. */
  compact?: boolean;
}) {
  const centers = zones.map((z) => z.center);
  const start: [number, number] = centers[0] ?? dots?.[0]?.point ?? [-31.5375, -68.5364];

  return (
    <MapContainer center={start} zoom={12} scrollWheelZoom={false} preferCanvas={(dots?.length ?? 0) > 1500} className={compact ? "field-map h-[460px] w-full" : "field-map h-[440px] w-full xl:h-[690px]"}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Fit points={centers.length ? centers : (dots ?? []).map((d) => d.point)} />
      {dots
        ? dots.map((dot) => (
            <CircleMarker
              key={`dot-${dot.id}`}
              center={dot.point}
              radius={5}
              className="pulse-bubble"
              pathOptions={{ color: "#070b14", weight: 1, fillColor: dot.color, fillOpacity: 0.9 }}
            />
          ))
        : zones.map((zone) => {
            const active = selected === zone.index;
            const dimmed = selected !== null && !active;
            return (
              <CircleMarker
                key={`zone-${zone.index}`}
                center={zone.center}
                radius={zone.radius}
                // Leaflet toma la clase solo al crear el trazo: va como propiedad, no dentro de pathOptions.
                className="pulse-bubble"
                pathOptions={{
                  color: active ? "#ffffff" : "#070b14",
                  weight: active ? 3 : 2,
                  fillColor: zone.color,
                  fillOpacity: dimmed ? 0.35 : 0.85,
                }}
                eventHandlers={{ click: () => onSelect(zone.index) }}
              >
                <Tooltip permanent direction="center" className="pulse-tag">
                  <span className="block text-center text-xs leading-tight">
                    <span className="block text-slate-300">{zone.name}</span>
                    <span className="block text-sm font-semibold text-white">{zone.value}</span>
                    {zone.few ? <span className="block text-[10px] text-amber-200">pocos casos</span> : null}
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}
    </MapContainer>
  );
}
