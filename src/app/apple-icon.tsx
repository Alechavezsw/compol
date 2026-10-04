import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3d2de0",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 96 }}>
          <div style={{ width: 22, height: 42, background: "#fff", opacity: 0.55, borderRadius: 6 }} />
          <div style={{ width: 22, height: 68, background: "#fff", opacity: 0.8, borderRadius: 6 }} />
          <div style={{ width: 22, height: 96, background: "#fff", borderRadius: 6 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
