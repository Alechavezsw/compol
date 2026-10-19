import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Paneles privados, accesos y las encuestas web (que se comparten por link, no se indexan).
        disallow: ["/admin", "/cliente", "/campo", "/login", "/inicio", "/auth", "/acceso-denegado", "/e/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
