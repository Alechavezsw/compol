/**
 * Marca de la app para íconos instalables (apple-icon, Android, escritorio).
 * Son las mismas tres barras del logo, sobre el azul institucional.
 *
 * `inset` es la proporción de margen alrededor de las barras: los íconos
 * "maskable" de Android se recortan en círculo o en gota, así que el dibujo
 * tiene que quedar dentro del 80% central.
 */
export const PWA_BRAND = "#0f4c6e";

export function PwaIconArt({ size, inset = 0.22 }: { size: number; inset?: number }) {
  const art = size * (1 - inset * 2);
  const bar = art * 0.23;
  const gap = art * 0.115;
  const radius = bar * 0.28;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: PWA_BRAND,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap, height: art }}>
        <div style={{ width: bar, height: art * 0.44, background: "#fff", opacity: 0.55, borderRadius: radius }} />
        <div style={{ width: bar, height: art * 0.71, background: "#fff", opacity: 0.8, borderRadius: radius }} />
        <div style={{ width: bar, height: art, background: "#fff", borderRadius: radius }} />
      </div>
    </div>
  );
}
