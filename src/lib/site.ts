const FALLBACK_URL = "https://compol.vercel.app";

export const SITE_NAME = "Consulta";
export const SITE_TAGLINE = "Plataforma de encuestas para gobiernos e instituciones";
export const SITE_DESCRIPTION =
  "Diseño de cuestionarios, trabajo de campo con cuotas por zona, tableros en vivo e informes asistidos por IA para organismos públicos e instituciones.";

export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_URL;
  return raw.replace(/\/$/, "");
}

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
