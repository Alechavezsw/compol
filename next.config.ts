import type { NextConfig } from "next";

/** Cabeceras que valen para todo el sitio. */
const BASE_HEADERS = [
  // El navegador no adivina el tipo de un archivo: un .csv no se interpreta como HTML.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Las URLs internas (con ids de encuestas) no viajan a sitios externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El campo usa geolocalización; cámara, micrófono y pagos no se usan en ninguna pantalla.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

/**
 * Anti-clickjacking: ningún panel, login ni formulario se puede incrustar en
 * otro sitio. Solo `/e/*` (la encuesta web que carga `widget.js` en un iframe)
 * queda afuera, por eso el patrón excluye ese prefijo.
 */
const NO_FRAMING_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  // No anunciar qué framework corre detrás.
  poweredByHeader: false,
  images: {
    qualities: [75, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: BASE_HEADERS },
      { source: "/((?!e/).*)", headers: NO_FRAMING_HEADERS },
    ];
  },
};

export default nextConfig;
