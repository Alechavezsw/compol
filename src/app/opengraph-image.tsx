import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07060f",
          padding: 72,
          color: "#f3effc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#3d2de0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 34 }}>
              <div style={{ width: 8, height: 15, background: "#fff", opacity: 0.55, borderRadius: 2 }} />
              <div style={{ width: 8, height: 24, background: "#fff", opacity: 0.8, borderRadius: 2 }} />
              <div style={{ width: 8, height: 34, background: "#fff", borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.4 }}>{SITE_NAME}</div>
            <div style={{ fontSize: 16, color: "rgba(243,239,252,0.62)" }}>Plataforma de encuestas</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 920 }}>
          <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.05, letterSpacing: -1.6 }}>
            El operativo, el tablero y el informe en un solo lugar.
          </div>
          <div style={{ fontSize: 26, color: "rgba(243,239,252,0.7)", lineHeight: 1.35 }}>{SITE_TAGLINE}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
