import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Survey } from "@/lib/types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { addDays, dayKey, daysBetween, formatDayKey, median } from "@/lib/stats";
import type { Pace } from "@/lib/analytics";
import { qualityFlags } from "@/lib/quality";
import { foldZone } from "@/lib/san-juan-zones";

type Client = SupabaseClient<Database>;

export type DashResponse = {
  survey_id: string;
  submitted_at: string | null;
  duration_seconds: number | null;
  channel: string | null;
  surveyor_id: string | null;
  zone: string | null;
};

export type DashSocial = {
  label: "positivo" | "neutral" | "negativo";
  engagement: number;
  topics: string[];
  published_at: string;
};

export type DashSurveyor = { id: string; name: string; daysSinceLast: number | null };

export function surveyPace(survey: Survey, rows: DashResponse[], today: string): Pace {
  const completed = rows.filter((r) => r.survey_id === survey.id);
  const perDay = new Map<string, number>();
  for (const r of completed) {
    if (!r.submitted_at) continue;
    const key = dayKey(r.submitted_at);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  let last7 = 0;
  for (let i = 0; i < 7; i += 1) last7 += perDay.get(addDays(today, -i)) ?? 0;
  const firstKey = [...perDay.keys()].sort()[0];
  const activeDays = firstKey ? Math.max(1, daysBetween(firstKey, today) + 1) : 0;
  const remaining = Math.max(0, survey.target_responses - completed.length);
  const perDayLast7 = last7 / 7;
  const endsAt = survey.ends_at ? dayKey(survey.ends_at) : null;
  const daysLeft = endsAt ? daysBetween(today, endsAt) + 1 : null;
  const daysToGoal = remaining === 0 ? 0 : perDayLast7 > 0 ? Math.ceil(remaining / perDayLast7) : null;
  return {
    perDayLast7,
    perDayOverall: activeDays ? completed.length / activeDays : 0,
    remaining,
    daysToGoal,
    eta: daysToGoal === null ? null : addDays(today, Math.max(0, daysToGoal - 1)),
    endsAt,
    daysLeft,
    requiredPerDay: daysLeft && daysLeft > 0 ? remaining / daysLeft : null,
    status:
      remaining === 0
        ? "cumplida"
        : perDayLast7 === 0
          ? "sin_ritmo"
          : daysLeft === null
            ? "sin_fecha"
            : daysToGoal !== null && daysToGoal <= Math.max(0, daysLeft)
              ? "en_ritmo"
              : "atrasada",
  };
}

export function expressCount(rows: DashResponse[]) {
  const campo = rows
    .filter((r) => (r.channel ?? "campo") === "campo" && (r.duration_seconds ?? 0) > 0)
    .map((r) => r.duration_seconds as number);
  const fieldMedian = median(campo);
  const threshold = fieldMedian ? Math.round(fieldMedian * 0.4) : null;
  if (!threshold) return 0;
  return campo.filter((d) => d < threshold).length;
}

export function socialPulse(posts: DashSocial[], today: string) {
  const from = addDays(today, -6);
  const current = posts.filter((p) => {
    const k = dayKey(p.published_at);
    return k >= from && k <= today;
  });
  let pos = 0;
  let neg = 0;
  let weight = 0;
  for (const p of current) {
    const w = 1 + Math.sqrt(Math.max(0, p.engagement));
    weight += w;
    if (p.label === "positivo") pos += w;
    if (p.label === "negativo") neg += w;
  }
  const mood = weight ? ((pos - neg) / weight) * 100 : 0;
  const negatives = current.filter((p) => p.label === "negativo").length;
  const alerts: { title: string; detail: string; topic?: string }[] = [];
  if (current.length >= 12 && negatives / current.length >= 0.35) {
    const topics = new Map<string, number>();
    for (const p of current) {
      if (p.label !== "negativo") continue;
      for (const t of p.topics) topics.set(t, (topics.get(t) ?? 0) + 1);
    }
    const topic = [...topics.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    alerts.push({
      title: "El radar viene negativo",
      detail: `${negatives} de ${current.length} notas de la semana son críticas${topic ? `, sobre todo por «${topic}»` : ""}.`,
      topic,
    });
  }
  return { mood, total: current.length, alerts };
}

export const loadDashboard = cache(async function loadDashboard(
  supabase: Client,
  organizationId: string,
  today: string,
) {
  const since14 = `${addDays(today, -13)}T00:00:00-03:00`;
  const socialSince = `${addDays(today, -13)}T00:00:00-03:00`;

  const [{ data: surveyRows }, completed, { data: reportRows }, { data: socialRows }, { data: assignmentRows }] =
    await Promise.all([
      supabase
        .from("surveys")
        .select(
          "id, organization_id, project_id, title, description, status, target_responses, starts_at, ends_at, geography, methodology, web_enabled, public_token, web_settings, created_by, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false }),
      fetchAll<DashResponse>((from, to) =>
        supabase
          .from("responses")
          .select("survey_id, submitted_at, duration_seconds, channel, surveyor_id, zone")
          .eq("organization_id", organizationId)
          .eq("status", "completada")
          .order("id")
          .range(from, to),
      ),
      supabase
        .from("ai_reports")
        .select("id, title, created_at, survey_id, kind")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("social_posts")
        .select("label, engagement, topics, published_at")
        .eq("organization_id", organizationId)
        .gte("published_at", new Date(socialSince).toISOString())
        .order("published_at", { ascending: false })
        .limit(200),
      supabase.from("survey_assignments").select("id, survey_id, surveyor_id, zone"),
    ]);

  const surveys = (surveyRows ?? []) as Survey[];
  const active = surveys.filter((s) => s.status === "activa");
  const activeIds = new Set(active.map((s) => s.id));
  const activeAssignments = (assignmentRows ?? []).filter((a) => activeIds.has(a.survey_id));
  const assignmentIds = activeAssignments.map((a) => a.id);
  const surveyorIds = [...new Set(activeAssignments.map((a) => a.surveyor_id))];

  const [{ data: zoneQuotaRows }, { data: profileRows }] = await Promise.all([
    assignmentIds.length
      ? supabase.from("survey_zone_quotas").select("assignment_id, zone, quota").in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] as { assignment_id: string; zone: string; quota: number }[] }),
    surveyorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", surveyorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const socialPosts = (socialRows ?? []) as DashSocial[];

  const names = new Map((profileRows ?? []).map((p) => [p.id, p.full_name]));
  const staleBySurvey = new Map<string, DashSurveyor[]>();
  for (const a of activeAssignments) {
    const last = completed
      .filter((r) => r.survey_id === a.survey_id && r.surveyor_id === a.surveyor_id && r.submitted_at)
      .map((r) => r.submitted_at as string)
      .sort()
      .at(-1);
    const days = last ? daysBetween(dayKey(last), today) : 99;
    if (days < 2) continue;
    const list = staleBySurvey.get(a.survey_id) ?? [];
    list.push({ id: a.surveyor_id, name: names.get(a.surveyor_id) ?? "Encuestador", daysSinceLast: last ? days : null });
    staleBySurvey.set(a.survey_id, list);
  }

  const countBySurvey = new Map<string, number>();
  for (const r of completed) countBySurvey.set(r.survey_id, (countBySurvey.get(r.survey_id) ?? 0) + 1);

  const byDay = new Map<string, number>();
  for (const r of completed) {
    if (!r.submitted_at) continue;
    const key = dayKey(r.submitted_at);
    if (key >= dayKey(since14)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).reduce<
    { key: string; name: string; value: number; cumulative: number }[]
  >((acc, key) => {
    const value = byDay.get(key) ?? 0;
    return [...acc, { key, name: formatDayKey(key), value, cumulative: (acc.at(-1)?.cumulative ?? 0) + value }];
  }, []);

  const paceBySurvey = new Map(active.map((s) => [s.id, surveyPace(s, completed, today)]));
  const expressBySurvey = new Map(active.map((s) => [s.id, expressCount(completed.filter((r) => r.survey_id === s.id))]));
  const social = socialPulse(socialPosts, today);

  const todayRows = completed.filter((r) => r.submitted_at && dayKey(r.submitted_at) === today);
  const todayBySurveyor = new Map<string, number>();
  const todayByZone = new Map<string, number>();
  for (const r of todayRows) {
    if (r.surveyor_id) todayBySurveyor.set(r.surveyor_id, (todayBySurveyor.get(r.surveyor_id) ?? 0) + 1);
    if (r.zone?.trim()) todayByZone.set(foldZone(r.zone), (todayByZone.get(foldZone(r.zone)) ?? 0) + 1);
  }

  const allowedZones = [...new Set((zoneQuotaRows ?? []).map((q) => q.zone))];
  const quality = qualityFlags(completed, allowedZones);

  const control = {
    today: todayRows.length,
    surveyors: [...new Map(activeAssignments.map((a) => [a.surveyor_id, a])).values()].map((a) => {
      const last = completed
        .filter((r) => r.surveyor_id === a.surveyor_id && r.submitted_at)
        .map((r) => r.submitted_at as string)
        .sort()
        .at(-1);
      return {
        id: a.surveyor_id,
        name: names.get(a.surveyor_id) ?? "Encuestador",
        today: todayBySurveyor.get(a.surveyor_id) ?? 0,
        lastAt: last ?? null,
        stalled: (todayBySurveyor.get(a.surveyor_id) ?? 0) === 0,
      };
    }),
    zones: (zoneQuotaRows ?? []).map((q) => ({
      zone: q.zone,
      quota: q.quota,
      today: todayByZone.get(foldZone(q.zone)) ?? 0,
      done: completed.filter((r) => r.zone && foldZone(r.zone) === foldZone(q.zone)).length,
    })),
    quality,
  };

  return {
    surveys,
    active,
    completedCount: completed.length,
    countBySurvey,
    days,
    paceBySurvey,
    expressBySurvey,
    staleBySurvey,
    reports: reportRows ?? [],
    social,
    control,
  };
});
