import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { PWA_BRAND } from "@/lib/pwa-icon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE_NAME} · Plataforma de encuestas`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    // Abre directo en el panel de cada rol (o en el login si no hay sesión).
    start_url: "/inicio?origen=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#e8eef2",
    theme_color: PWA_BRAND,
    lang: "es-AR",
    dir: "ltr",
    categories: ["productivity", "government", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Mi panel",
        short_name: "Panel",
        url: "/inicio?origen=atajo",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Trabajo de campo",
        short_name: "Campo",
        description: "Mis asignaciones y la carga de entrevistas",
        url: "/campo",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
