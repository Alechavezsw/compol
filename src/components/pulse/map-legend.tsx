import { decimal, type MapMetric } from "@/components/pulse/map-paint";

/** Cómo leer el color de las burbujas. Va encima del mapa, abajo a la izquierda. */
export function MapLegend({ metric, low, high }: { metric: MapMetric; low: number; high: number }) {
  return (
    <div className="pointer-events-none absolute bottom-6 left-3 z-[1000] rounded-xl border border-white/10 bg-[#0b1220]/90 px-3 py-2 text-xs text-slate-300">
      {metric === "saldo" ? (
        <span className="flex items-center gap-2">
          En contra
          <span className="h-2 w-24 rounded-full bg-[linear-gradient(90deg,#f6946b,#8d88a3,#4cd9bd)]" />A favor
        </span>
      ) : metric === "promedio" ? (
        <span className="flex items-center gap-2">
          {decimal(low)}
          <span className="h-2 w-24 rounded-full bg-[linear-gradient(90deg,#2f5f58,#7cf0d6)]" />
          {decimal(high)}
        </span>
      ) : (
        "Más grande y más claro: más casos"
      )}
    </div>
  );
}
