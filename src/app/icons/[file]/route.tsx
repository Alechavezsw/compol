import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { PwaIconArt } from "@/lib/pwa-icon";

/**
 * Íconos PNG que pide el manifest para que Android y Chrome ofrezcan instalar
 * la app. Se generan una sola vez en el build.
 */
const ICONS = {
  "icon-192.png": { size: 192, inset: 0.22 },
  "icon-512.png": { size: 512, inset: 0.22 },
  // Android recorta este en círculo: el dibujo va más adentro.
  "maskable-512.png": { size: 512, inset: 0.3 },
} as const;

type IconFile = keyof typeof ICONS;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[file]">) {
  const { file } = await params;
  const icon = ICONS[file as IconFile];
  if (!icon) notFound();

  return new ImageResponse(<PwaIconArt size={icon.size} inset={icon.inset} />, {
    width: icon.size,
    height: icon.size,
    headers: { "Cache-Control": "public, max-age=604800, immutable" },
  });
}
