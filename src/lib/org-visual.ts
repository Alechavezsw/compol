import type { OrgType } from "@/lib/types";

/** Paleta de marca sugerida al crear o editar un cliente. */
export const ORG_BRAND_SWATCHES = [
  { hex: "#1e40af", name: "Azul institucional" },
  { hex: "#0f766e", name: "Verde municipio" },
  { hex: "#7c3aed", name: "Violeta" },
  { hex: "#be185d", name: "Fucsia" },
  { hex: "#c2410c", name: "Terracota" },
  { hex: "#0369a1", name: "Celeste" },
  { hex: "#15803d", name: "Verde" },
  { hex: "#b45309", name: "Ámbar" },
  { hex: "#334155", name: "Pizarra" },
] as const;

const TYPE_FALLBACK: Record<OrgType, string> = {
  gobierno: "#1e40af",
  institucion: "#0f766e",
  ong: "#be185d",
  privado: "#7c3aed",
};

function hashHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Color de marca: el guardado, o uno estable según tipo y nombre. */
export function orgBrandColor(org: {
  brand_color?: string | null;
  type: OrgType;
  id?: string;
  name?: string;
}) {
  if (org.brand_color && /^#[0-9a-fA-F]{6}$/.test(org.brand_color)) {
    return org.brand_color.toLowerCase();
  }
  const seed = org.id || org.name || org.type;
  const idx = hashHue(seed) % ORG_BRAND_SWATCHES.length;
  // Si no hay color cargado, preferimos el del tipo; si chocan varios del mismo
  // tipo, el hash del nombre los separa en la paleta.
  return org.name || org.id ? ORG_BRAND_SWATCHES[idx].hex : TYPE_FALLBACK[org.type];
}

export function pickOrgBrandColor(used: string[] = []) {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  const free = ORG_BRAND_SWATCHES.find((s) => !taken.has(s.hex));
  return (free ?? ORG_BRAND_SWATCHES[hashHue(String(Date.now())) % ORG_BRAND_SWATCHES.length]).hex;
}
