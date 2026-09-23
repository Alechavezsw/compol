import Link from "next/link";
import { CheckCircle2, ClipboardList, MapPin, Play, Target } from "lucide-react";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { SurveyStatusBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { requireRole } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/utils";
import { dayKey, todayKey } from "@/lib/stats";
import type { Survey } from "@/lib/types";

export default async function CampoPage() {
  const { profile } = await requireRole(["surveyor"]);
  const supabase = await createClient();

  const [{ data: assignmentRows }, { data: responseRows }] = await Promise.all([
    supabase
      .from("survey_assignments")
      .select("*, surveys(*)")
      .eq("surveyor_id", profile.id),
    fetchAll<{ survey_id: string; surveyor_id: string | null; submitted_at: string | null }>((from, to) =>
      supabase.from("responses")
      .select("survey_id, submitted_at")
      .eq("surveyor_id", profile.id)
      .eq("status", "completada")
      .order("id").range(from, to),
    ).then((data) => ({ data })),
  ]);

  // La encuesta puede venir nula si se borró; nos quedamos solo con las vivas.
  const assignments = (assignmentRows ?? []).flatMap((a) =>
    a.surveys ? [{ ...a, surveys: a.surveys as Survey }] : [],
  );

  const doneBySurvey = new Map<string, number>();
  for (const r of responseRows ?? []) {
    doneBySurvey.set(r.survey_id, (doneBySurvey.get(r.survey_id) ?? 0) + 1);
  }

  // "Hoy" en hora argentina: una carga a las 22 h no puede contar para mañana.
  const today = todayKey();
  const doneToday = (responseRows ?? []).filter((r) => r.submitted_at && dayKey(r.submitted_at) === today).length;

  const totalDone = (responseRows ?? []).length;
  const totalQuota = assignments.reduce((sum, a) => sum + a.quota, 0);

  const activos = assignments.filter((a) => a.surveys.status === "activa");
  const otros = assignments.filter((a) => a.surveys.status !== "activa");

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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Cargadas hoy"
          value={formatNumber(doneToday)}
          icon={<CheckCircle2 className="size-4" />}
          tone="success"
        />
        <StatCard
          label="Total cargadas"
          value={formatNumber(totalDone)}
          icon={<ClipboardList className="size-4" />}
        />
        <StatCard
          label="Cuota total"
          value={formatNumber(totalQuota)}
          icon={<Target className="size-4" />}
          tone="accent"
          hint={
            totalQuota
              ? `${((totalDone / totalQuota) * 100).toFixed(0)}% de cumplimiento`
              : "Sin cuotas asignadas"
          }
        />
      </div>

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

                    <ButtonLink
                      href={`/campo/encuestas/${a.survey_id}`}
                      size="lg"
                      className="mt-5 w-full"
                    >
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
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {a.surveys.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {formatNumber(doneBySurvey.get(a.survey_id) ?? 0)} entrevistas cargadas
                    </p>
                  </div>
                  <SurveyStatusBadge status={a.surveys.status} />
                </div>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
