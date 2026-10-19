import Link from "next/link";
import { ClipboardList, MapPin, Play } from "lucide-react";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Badge, SurveyStatusBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { addDays, dayBoundsIso, dayKey, todayKey } from "@/lib/stats";
import { acceptsResponses, isExpired } from "@/lib/survey-status";
import { foldZone } from "@/lib/san-juan-zones";
import type { Survey, SurveyZoneQuota } from "@/lib/types";

export default async function CampoPage() {
  const { profile } = await requireRole(["surveyor"]);
  const supabase = await createClient();
  const today = todayKey();
  const { start: todayStart, end: todayEnd } = dayBoundsIso(today);

  const [{ data: assignmentRows }, todayRes, { data: zoneRows }, { data: quotaRows }] = await Promise.all([
    supabase
      .from("survey_assignments")
      .select("id, survey_id, quota, zone, surveys(id, title, status, ends_at)")
      .eq("surveyor_id", profile.id),
    supabase
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("surveyor_id", profile.id)
      .eq("status", "completada")
      .gte("submitted_at", todayStart)
      .lt("submitted_at", todayEnd),
    supabase.from("responses").select("survey_id, zone").eq("surveyor_id", profile.id).eq("status", "completada"),
    supabase.from("survey_zone_quotas").select("*"),
  ]);

  const assignments = (assignmentRows ?? []).flatMap((a) =>
    a.surveys ? [{ ...a, surveys: a.surveys as Survey }] : [],
  );

  const quotasByAssignment = new Map<string, SurveyZoneQuota[]>();
  for (const q of (quotaRows ?? []) as SurveyZoneQuota[]) {
    const list = quotasByAssignment.get(q.assignment_id) ?? [];
    list.push(q);
    quotasByAssignment.set(q.assignment_id, list);
  }

  const doneBySurvey = new Map<string, number>();
  const doneByZone = new Map<string, number>();
  for (const r of zoneRows ?? []) {
    doneBySurvey.set(r.survey_id, (doneBySurvey.get(r.survey_id) ?? 0) + 1);
    if (r.zone?.trim()) {
      const key = `${r.survey_id}:${foldZone(r.zone)}`;
      doneByZone.set(key, (doneByZone.get(key) ?? 0) + 1);
    }
  }
  const doneToday = todayRes.count ?? 0;
  const totalDone = [...doneBySurvey.values()].reduce((sum, n) => sum + n, 0);
  const totalQuota = assignments.reduce((sum, a) => sum + a.quota, 0);
  const activos = assignments.filter((a) => acceptsResponses(a.surveys));
  const otros = assignments.filter((a) => !acceptsResponses(a.surveys));

  /** Aviso corto para que nadie se entere del cierre cuando ya no puede cargar. */
  const closingHint = (endsAt: string | null) => {
    if (!endsAt) return null;
    const end = dayKey(endsAt);
    if (end === today) return "Cierra hoy";
    if (end === addDays(today, 1)) return "Cierra mañana";
    return null;
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          <span className="text-sm font-medium text-[var(--muted)]">
            Hola, {profile.full_name.split(" ")[0] || "encuestador"}
          </span>
        }
        title="Mis asignaciones"
        description="Estas son las encuestas que tenés para relevar. Tocá una para empezar a cargar entrevistas."
      />

      {/* Resumen compacto: en el celular no debe empujar las asignaciones fuera de pantalla. */}
      <dl className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Hoy", value: formatNumber(doneToday), hint: "cargadas", accent: "text-[var(--success)]" },
          { label: "Total", value: formatNumber(totalDone), hint: "cargadas", accent: "text-[var(--foreground)]" },
          {
            label: "Cuota",
            value: formatNumber(totalQuota),
            hint: totalQuota ? `${((totalDone / totalQuota) * 100).toFixed(0)}% cumplido` : "sin asignar",
            accent: "text-[var(--accent)]",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-3 shadow-[var(--shadow-card)] sm:p-4"
          >
            <dt className="text-xs font-medium text-[var(--muted)]">{item.label}</dt>
            <dd className={cn("display mt-1 text-3xl leading-none tabular-nums sm:text-4xl", item.accent)}>{item.value}</dd>
            <p className="mt-1.5 truncate text-xs text-[var(--muted)]">{item.hint}</p>
          </div>
        ))}
      </dl>

      {assignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="Todavía no tenés encuestas asignadas"
          description="Cuando la coordinación te asigne un operativo, va a aparecer acá."
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
              En campo ahora
            </h2>

            {activos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">
                Ninguna de tus encuestas está activa en este momento.
              </p>
            ) : (
              activos.map((a) => {
                const done = doneBySurvey.get(a.survey_id) ?? 0;
                return (
                  <article
                    key={a.id}
                    className="relative overflow-hidden rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-5 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/campo/encuestas/${a.survey_id}`}
                          className="text-[15px] font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--primary)]"
                        >
                          {a.surveys.title}
                        </Link>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                          {a.zone ? (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="size-3.5" />
                              {a.zone}
                            </span>
                          ) : null}
                          <span>Cierre: {formatDate(a.surveys.ends_at)}</span>
                          {closingHint(a.surveys.ends_at) ? (
                            <Badge tone="warning">{closingHint(a.surveys.ends_at)}</Badge>
                          ) : null}
                        </p>
                      </div>
                      <SurveyStatusBadge status={a.surveys.status} />
                    </div>

                    <div className="mt-5 flex items-center gap-3">
                      <Progress
                        value={done}
                        max={a.quota}
                        tone={done >= a.quota ? "success" : "primary"}
                        className="flex-1"
                      />
                      <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--muted)]">
                        {formatNumber(done)} / {formatNumber(a.quota)}
                      </span>
                    </div>
                    {quotasByAssignment.get(a.id)?.length ? (
                      <ul className="mt-4 space-y-2">
                        {quotasByAssignment.get(a.id)!.map((q) => {
                          const zDone = doneByZone.get(`${a.survey_id}:${foldZone(q.zone)}`) ?? 0;
                          return (
                            <li key={q.id} className="flex items-center gap-3 text-xs">
                              <span className="w-28 shrink-0 truncate text-[var(--muted)]">{q.zone}</span>
                              <Progress
                                value={zDone}
                                max={q.quota}
                                tone={zDone >= q.quota ? "success" : "primary"}
                                className="flex-1"
                              />
                              <span className="w-12 shrink-0 text-right tabular-nums text-[var(--muted)]">
                                {zDone}/{q.quota}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    <ButtonLink href={`/campo/encuestas/${a.survey_id}`} size="lg" className="mt-5 w-full">
                      <Play />
                      Cargar entrevista
                    </ButtonLink>
                  </article>
                );
              })
            )}
          </section>

          {otros.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
                Otras asignaciones
              </h2>
              {otros.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">{a.surveys.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {formatNumber(doneBySurvey.get(a.survey_id) ?? 0)} entrevistas cargadas
                    </p>
                  </div>
                  {isExpired(a.surveys) && a.surveys.status === "activa" ? (
                    <Badge tone="warning">Vencida</Badge>
                  ) : (
                    <SurveyStatusBadge status={a.surveys.status} />
                  )}
                </div>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
