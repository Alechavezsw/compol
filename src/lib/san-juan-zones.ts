/** Localidades y barrios del operativo en San Juan. El campo las busca desde 3 letras. */

export const SAN_JUAN_ZONES = [
  "Capital",
  "Centro",
  "Rawson",
  "Villa Krause",
  "Rivadavia",
  "Chimbas",
  "Santa Lucía",
  "Pocito",
  "9 de Julio",
  "Albardón",
  "Angaco",
  "San Martín",
  "Caucete",
  "25 de Mayo",
  "Sarmiento",
  "Ullum",
  "Zonda",
  "Jáchal",
  "Iglesia",
  "Calingasta",
  "Valle Fértil",
  "Trinidad",
  "Concepción",
  "Desamparados",
  "Marquesado",
  "La Bebida",
  "Médano de Oro",
  "Villa Barboza",
  "El Mogote",
  "Villa El Salvador",
  "Villa del Carmen",
  "Villa Obrera",
  "Villa San Martín",
  "Las Piedritas",
  "El Bosque",
  "Barrio Mitre",
  "Barrio Independencia",
  "Barrio Jardín",
  "Barrio Rawson",
  "Barrio Municipal",
  "Barrio Parque de Mayo",
  "Barrio Universitario",
  "Barrio Graffigna",
  "Comandante Cabot",
] as const;

/** Reparto típico de un operativo en el Gran San Juan. */
export const GRAN_SAN_JUAN_QUOTAS: { zone: string; quota: number }[] = [
  { zone: "Capital", quota: 18 },
  { zone: "Rawson", quota: 15 },
  { zone: "Rivadavia", quota: 15 },
  { zone: "Chimbas", quota: 12 },
  { zone: "Santa Lucía", quota: 10 },
  { zone: "Pocito", quota: 10 },
];

export function foldZone(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function searchZones(query: string, extra: readonly string[] = [], limit = 8) {
  const q = foldZone(query);
  if (q.length < 3) return [];

  const seen = new Set<string>();
  const pool: string[] = [];
  for (const zone of [...extra, ...SAN_JUAN_ZONES]) {
    const name = zone.trim();
    const key = foldZone(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    pool.push(name);
  }

  return pool.filter((zone) => foldZone(zone).includes(q)).slice(0, limit);
}
