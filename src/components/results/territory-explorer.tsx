"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LikertBars, RankBars, ToneLegend } from "@/components/pulse/bars";
import { MapLegend } from "@/components/pulse/map-legend";
import { averageRange, paintZones, type MapMetric, type MapSummary } from "@/components/pulse/map-paint";
import { Segmented } from "@/components/pulse/segmented";
import { ZoneMap } from "@/components/pulse/zone-map";
import { FieldMap, type FieldMapPoint } from "@/components/results/field-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Share } from "@/lib/pulse";
import { cn, formatNumber } from "@/lib/utils";

export type ZoneView = MapSummary & { shares: Share[]; base: number };

/**
 * Mapa y ranking de zonas de Resultados. Tocar una zona la pone en los filtros
 * de la dirección, así el resto del tablero y la exportación usan el mismo recorte.
 */
export function TerritoryExplorer({
  zones,
  centers,
  selected,
  points,
  hasEvaluation,
  hasAverage,
  note,
  children,
}: {
  zones: ZoneView[];
  centers: ([number, number] | null)[];
  /** Zona filtrada en la dirección, si hay una. */
  selected: string | null;
  points: FieldMapPoint[];
  hasEvaluation: boolean;
  hasAverage: boolean;
  /** Pregunta que define el saldo, para explicar el ranking. */
  note: string | null;
  /** Detalle de canales y orígenes, debajo del ranking. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [metric, setMetric] = useState<MapMetric>(hasEvaluation ? "saldo" : hasAverage ? "promedio" : "casos");
  const [view, setView] = useState<"zonas" | "casos">("zonas");

  const mapZones = paintZones(zones, centers, metric);
  const canDrawZones = mapZones.length > 0;
  const shown = !canDrawZones ? "casos" : points.length ? view : "zonas";
  const { low, high } = averageRange(zones);
  const selectedIndex = zones.find((z) => z.name === selected)?.index ?? null;

  const toggle = (name: string) => {
    const params = new URLSearchParams(search.toString());
    if (selected === name) params.delete("zona");
    else params.set("zona", name);
    const query = params.toString();
    startTransition(() => router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false }));
  };
  const byIndex = (index: number) => {
    const zone = zones.find((z) => z.index === index);
    if (zone) toggle(zone.name);
  };

  const total = zones.reduce((sum, z) => sum + z.count, 0);
  const metricOptions = [
    ...(hasEvaluation ? [{ value: "saldo" as const, label: "Saldo" }] : []),
    ...(hasAverage ? [{ value: "promedio" as const, label: "Promedio" }] : []),
    { value: "casos" as const, label: "Casos" },
  ];

  const hasMap = canDrawZones || points.length > 0;
  const hasAside = zones.length > 0 || Boolean(children);
  if (!hasMap && !hasAside) return null;

  return (
    <div className={cn("grid items-start gap-4 transition-opacity xl:grid-cols-5", pending && "opacity-60")} aria-busy={pending}>
      {hasMap ? (
        <Card className={hasAside ? "xl:col-span-3" : "xl:col-span-5"}>
          <CardHeader>
            <div>
              <CardTitle>Mapa del territorio</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {shown === "zonas" ? "Tocá una zona para filtrar todos los resultados." : "Cada punto es un caso con ubicación aproximada."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {shown === "zonas" && metricOptions.length > 1 ? (
                <Segmented label="Qué muestra el mapa" value={metric} options={metricOptions} onChange={setMetric} />
              ) : null}
              {canDrawZones && points.length ? (
                <Segmented
                  label="Cómo se dibuja"
                  value={view}
                  options={[
                    { value: "zonas", label: "Zonas" },
                    { value: "casos", label: "Casos" },
                  ]}
                  onChange={setView}
                />
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {shown === "zonas" ? (
              <div className="relative isolate overflow-hidden rounded-2xl bg-[#070b14]">
                <ZoneMap zones={mapZones} dots={null} selected={selectedIndex} onSelect={byIndex} compact />
                <MapLegend metric={metric} low={low} high={high} />
              </div>
            ) : (
              <div className="relative isolate">
                <FieldMap points={points} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {hasAside ? (
        <Card className={hasMap ? "xl:col-span-2" : "xl:col-span-5"}>
          <CardHeader>
            <div>
              <CardTitle>{zones.length ? "Zona por zona" : "Desde dónde responden"}</CardTitle>
              {zones.length ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {hasEvaluation && note ? `Ordenadas por saldo. ${note}` : "Qué parte de los casos aporta cada lugar."}
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {zones.length && hasEvaluation ? (
              <div>
                <ToneLegend shares={zones[0].shares} />
                <div className="mt-4">
                  <LikertBars
                    rows={zones.map((z) => ({ key: z.name, label: z.name, shares: z.shares, net: z.net, base: z.base }))}
                    sortByNet
                    selected={selected}
                    onSelect={toggle}
                  />
                </div>
              </div>
            ) : zones.length ? (
              <RankBars
                shares={zones.map((z) => ({
                  index: z.index,
                  label: `${z.name} (${formatNumber(z.count)})`,
                  tone: "sin_dato" as const,
                  count: z.count,
                  percent: total ? (z.count / total) * 100 : 0,
                }))}
              />
            ) : null}
            {children}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
