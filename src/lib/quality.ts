import { foldZone } from "@/lib/san-juan-zones";

export type QualityRow = {
  surveyor_id: string | null;
  zone: string | null;
  channel: string | null;
  duration_seconds: number | null;
  submitted_at: string | null;
};

export type QualityBurst = { zone: string; count: number; surveyorId: string };

export function qualityFlags(
  rows: QualityRow[],
  allowedZones: string[] = [],
): {
  express: number;
  bursts: QualityBurst[];
  offQuota: number;
} {
  const campo = rows.filter((r) => (r.channel ?? "campo") === "campo");
  const durations = campo.map((r) => r.duration_seconds).filter((n): n is number => typeof n === "number" && n > 0);
  const median = medianOf(durations);
  const threshold = median ? Math.round(median * 0.4) : null;
  const express = threshold ? campo.filter((r) => (r.duration_seconds ?? 0) > 0 && (r.duration_seconds as number) < threshold).length : 0;

  const allowed = new Set(allowedZones.map(foldZone).filter(Boolean));
  const offQuota =
    allowed.size === 0
      ? 0
      : campo.filter((r) => {
          const z = r.zone?.trim();
          return z && !allowed.has(foldZone(z));
        }).length;

  const bursts: QualityBurst[] = [];
  const byKey = new Map<string, { at: number; zone: string; surveyorId: string }[]>();
  for (const r of campo) {
    if (!r.surveyor_id || !r.submitted_at || !r.zone?.trim()) continue;
    const key = `${r.surveyor_id}:${foldZone(r.zone)}`;
    const list = byKey.get(key) ?? [];
    list.push({ at: new Date(r.submitted_at).getTime(), zone: r.zone.trim(), surveyorId: r.surveyor_id });
    byKey.set(key, list);
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => a.at - b.at);
    for (let i = 0; i < list.length; i += 1) {
      let count = 1;
      for (let j = i + 1; j < list.length; j += 1) {
        if (list[j].at - list[i].at > 30 * 60 * 1000) break;
        count += 1;
      }
      if (count >= 4) {
        bursts.push({ zone: list[i].zone, count, surveyorId: list[i].surveyorId });
        break;
      }
    }
  }

  return { express, bursts, offQuota };
}

function medianOf(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
