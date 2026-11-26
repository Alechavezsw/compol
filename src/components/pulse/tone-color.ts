import type { EvalTone } from "@/lib/pulse";

/**
 * Color de cada tono de evaluación (los define `globals.css` para tema claro y
 * oscuro). Vive fuera de los componentes de cliente porque también lo usa el servidor.
 */
export const TONE_COLOR: Record<EvalTone, string> = {
  muy_neg: "var(--eval-muy-neg)",
  neg: "var(--eval-neg)",
  neutro: "var(--eval-neutro)",
  pos: "var(--eval-pos)",
  muy_pos: "var(--eval-muy-pos)",
  sin_dato: "var(--eval-na)",
};
