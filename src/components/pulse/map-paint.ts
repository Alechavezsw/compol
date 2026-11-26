import type { MapZone } from "@/components/pulse/zone-map";
import { signed, type EvalTone } from "@/lib/pulse";
import { SMALL_BASE } from "@/lib/stats";
import { formatNumber } from "@/lib/utils";

export type MapMetric = "saldo" | "promedio" | "casos";

/** El mapa es oscuro en los dos temas, así que usa siempre estos tonos. */
export const MAP_TONE: Record<EvalTone, string> = {
  muy_pos: "#4cd9bd",
  pos: "#1f9e86",
  neutro: "#8d88a3",
  neg: "#cf6a43",
  muy_neg: "#f6946b",
  sin_dato: "#475569",
};
const NO_DATA = "#475569";

function mix(from: string, to: string, t: number) {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [parse(from), parse(to)];
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

export const decimal = (value: number) => value.toFixed(1).replace(".", ",");

export type MapSummary = {
  index: number;
  name: string;
  count: number;
  net: number | null;
  average: number | null;
};

/** Rango de promedios entre zonas: el color y la leyenda se estiran entre esos dos valores. */
export function averageRange(zones: MapSummary[]) {
  const averages = zones.map((z) => z.average).filter((a): a is number => a !== null);
  return averages.length ? { low: Math.min(...averages), high: Math.max(...averages) } : { low: 0, high: 1 };
}

/** Burbujas listas para dibujar. Las zonas sin ubicación quedan afuera. */
export function paintZones(zones: MapSummary[], centers: ([number, number] | null)[], metric: MapMetric): MapZone[] {
  const maxCount = Math.max(1, ...zones.map((z) => z.count));
  const { low, high } = averageRange(zones);
  const color = (z: MapSummary) => {
    if (!z.count) return NO_DATA;
    if (metric === "saldo") {
      return z.net === null ? NO_DATA : mix("#8d88a3", z.net >= 0 ? "#4cd9bd" : "#f6946b", Math.min(1, Math.abs(z.net) / 50));
    }
    if (metric === "promedio") return z.average === null ? NO_DATA : mix("#2f5f58", "#7cf0d6", (z.average - low) / (high - low || 1));
    return mix("#4a3f8f", "#b3a8ff", z.count / maxCount);
  };
  const reading = (z: MapSummary) => {
    if (!z.count) return "sin casos";
    if (metric === "saldo") return z.net === null ? "—" : signed(z.net);
    if (metric === "promedio") return z.average === null ? "—" : decimal(z.average);
    return formatNumber(z.count);
  };
  return zones.flatMap((z) => {
    const center = centers[z.index];
    if (!center) return [];
    return [
      {
        index: z.index,
        name: z.name,
        center,
        radius: z.count ? 18 + 24 * Math.sqrt(z.count / maxCount) : 10,
        color: color(z),
        value: reading(z),
        few: z.count > 0 && z.count < SMALL_BASE,
      },
    ];
  });
}
