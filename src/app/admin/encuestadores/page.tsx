import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, ClipboardCheck, MapPin, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { Avatar, EmptyState, Notice, PageHeader, Progress } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, SurveyStatusBadge } from "@/components/ui/badge";
import { AssignForm } from "./assign-form";
import { ZoneQuotasFields } from "@/components/zone-quotas-fields";
import { removeAssignmentAction, toggleUserActiveAction, updateAssignmentAction } from "../actions";
import type { SurveyZoneQuota } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { dayKey, daysBetween, todayKey } from "@/lib/stats";
import { cn, formatNumber } from "@/lib/utils";
import type { Profile, Survey, SurveyAssignment } from "@/lib/types";

export const metadata: Metadata = { title: "Encuestadores" };

export default async function EncuestadoresPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const supabase = await createClient();

  const [{ data: orgRows }, { data: profileRows }, { data: surveyRows }, { data: assignmentRows }, { data: quotaRows }, responses] =
    await Promise.all([
      supabase.from("organizations").select("id, name").order("name"),
      supabase.from("profiles").select("*").eq("role", "surveyor").order("full_name"),
      supabase.from("surveys").select("*").order("updated_at", { ascending: false }),
      supabase.from("survey_assignments").select("*"),
      supabase.from("survey_zone_quotas").select("*"),
      fetchAll<{ survey_id: string; surveyor_id: string | null; submitted_at: string | null }>((from, to) =>
        supabase
          .from("responses")
          .select("survey_id, surveyor_id, submitted_at")
          .eq("status", "completada")
          .eq("channel", "campo")
          .order("id")
          .range(from, to),
      ),
    ]);

  const orgs = (orgRows ?? []) as { id: string; name: string }[];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const surveyors = ((profileRows ?? []) as Profile[]).filter((p) => !org || p.organization_id === org);
  const surveys = (surveyRows ?? []) as Survey[];
  const surveyById = new Map(surveys.map((s) => [s.id, s]));
  const assignments = (assignmentRows ?? []) as SurveyAssignment[];
  const quotasByAssignment = new Map<string, SurveyZoneQuota[]>();
  for (const q of (quotaRows ?? []) as SurveyZoneQuota[]) {
    const list = quotasByAssignment.get(q.assignment_id) ?? [];
    list.push(q);
    quotasByAssignment.set(q.assignment_id, list);
  }

  const today = todayKey();
  const doneBy = new Map<string, number>();
  const todayBy = new Map<string, number>();
  const lastBy = new Map<string, string>();
  for (const r of responses) {
    if (!r.surveyor_id) continue;
    const key = `${r.survey_id}:${r.surveyor_id}`;
    doneBy.set(key, (doneBy.get(key) ?? 0) + 1);
    if (r.submitted_at) {
      if (dayKey(r.submitted_at) === today) todayBy.set(r.surveyor_id, (todayBy.get(r.surveyor_id) ?? 0) + 1);
      if ((lastBy.get(r.surveyor_id) ?? "") < r.submitted_at) lastBy.set(r.surveyor_id, r.submitted_at);
    }
  }

  const quotaBySurvey = new Map<string, number>();
  for (const a of assignments) quotaBySurvey.set(a.survey_id, (quotaBySurvey.get(a.survey_id) ?? 0) + a.quota);

  const visibleIds = new Set(surveyors.map((s) => s.id));
  const activeAssignments = assignments.filter(
    (a) => visibleIds.has(a.surveyor_id) && surveyById.get(a.survey_id)?.status === "activa",
  );
  const stale = surveyors.filter((s) => {
    const hasActive = activeAssignments.some((a) => a.surveyor_id === s.id);
    const last = lastBy.get(s.id);
    return s.is_active && hasActive && (!last || daysBetween(dayKey(last), today) >= 2);
  });

  // Encuestas que necesitan equipo: activas o en borrador cuyas cuotas no llegan a la meta.
  const uncovered = surveys
    .filter((s) => (s.status === "activa" || s.status === "borrador") && (!org || s.organization_id === org))
    .filter((s) => !s.web_enabled || s.status === "borrador")
    .map((s) => ({ survey: s, gap: s.target_responses - (quotaBySurvey.get(s.id) ?? 0) }))
    .filter((x) => x.gap > 0);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          <Badge tone="primary">
            <ShieldCheck className="size-3" />
            Solo administración central
          </Badge>
        }
        title="Encuestadores"
        description="El equipo de campo de todos los clientes: altas, bloqueos, asignaciones y cuotas. Los clientes ven el avance pero no pueden modificar el equipo."
        actions={
          <ButtonLink href={`/admin/usuarios/nuevo?rol=surveyor&volver=/admin/encuestadores${org ? `&org=${org}` : ""}`}>
            <UserPlus />
            Nuevo encuestador
          </ButtonLink>
        }
      />

      <div className="flex flex-wrap gap-2">
        <FilterChip href="/admin/encuestadores" active={!org}>
          Todas las organizaciones
        </FilterChip>
        {orgs.map((o) => (
          <FilterChip key={o.id} href={`/admin/encuestadores?org=${o.id}`} active={org === o.id}>
            {o.name}
          </FilterChip>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Encuestadores activos"
          value={formatNumber(surveyors.filter((s) => s.is_active).length)}
          icon={<Users className="size-4" />}
          hint={`${surveyors.filter((s) => !s.is_active).length} bloqueados`}
        />
        <StatCard
          label="Asignaciones en campo"
          value={formatNumber(activeAssignments.length)}
          icon={<ClipboardCheck className="size-4" />}
          tone="accent"
          hint="En encuestas activas"
        />
        <StatCard
          label="Casos cargados hoy"
          value={formatNumber(surveyors.reduce((s, p) => s + (todayBy.get(p.id) ?? 0), 0))}
          icon={<MapPin className="size-4" />}
          tone="success"
        />
        <StatCard
          label="Sin carga en 48 h"
          value={formatNumber(stale.length)}
          icon={<CalendarClock className="size-4" />}
          tone="warning"
          hint={stale.length ? stale.map((s) => s.full_name.split(" ")[0]).join(", ") : "Todo el equipo cargando"}
        />
      </div>

      {uncovered.length ? (
        <Notice tone="warning" icon={<AlertTriangle />}>
          <strong className="font-semibold">Cuotas por debajo de la meta:</strong>{" "}
          {uncovered.map((x, i) => (
            <span key={x.survey.id}>
              {i ? " · " : ""}«{x.survey.title}» ({orgName.get(x.survey.organization_id)}) necesita {formatNumber(x.gap)} casos más
            </span>
          ))}
          .
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {surveyors.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No hay encuestadores"
              description="Dalos de alta desde acá; después asignales encuestas con su cuota y zona."
            />
          ) : (
            surveyors.map((s) => {
              const mine = assignments.filter((a) => a.surveyor_id === s.id);
              const last = lastBy.get(s.id);
              const days = last ? daysBetween(dayKey(last), today) : null;
              const isStale = stale.some((x) => x.id === s.id);
              return (
                <Card key={s.id} className={cn(!s.is_active && "opacity-70")}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar name={s.full_name} src={s.avatar_url} size={42} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--foreground)]">{s.full_name}</p>
                          <Badge tone={s.is_active ? "success" : "danger"} dot={s.is_active}>
                            {s.is_active ? "Activo" : "Bloqueado"}
                          </Badge>
                          {isStale ? (
                            <Badge tone="warning">
                              <CalendarClock className="size-3" />
                              {days === null ? "Nunca cargó" : `Sin carga hace ${days} días`}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                          {orgName.get(s.organization_id ?? "") ?? "Sin organización"} · {s.email}
                          {todayBy.get(s.id) ? ` · ${todayBy.get(s.id)} casos hoy` : ""}
                        </p>
                      </div>
                      <form action={toggleUserActiveAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="next" value={String(!s.is_active)} />
                        <button
                          type="submit"
                          className={cn(
                            "h-8 rounded-xl border px-3 text-xs font-medium transition-colors",
                            s.is_active
                              ? "border-[var(--border)] text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                              : "border-[var(--success)] text-[var(--success)] hover:bg-[var(--success-soft)]",
                          )}
                        >
                          {s.is_active ? "Bloquear" : "Reactivar"}
                        </button>
                      </form>
                    </div>

                    {mine.length ? (
                      <ul className="mt-4 space-y-2">
                        {mine.map((a) => {
                          const survey = surveyById.get(a.survey_id);
                          const done = doneBy.get(`${a.survey_id}:${s.id}`) ?? 0;
                          return (
                            <li key={a.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--foreground)]">
                                  {survey?.title ?? "Encuesta eliminada"}
                                </p>
                                {survey ? <SurveyStatusBadge status={survey.status} /> : null}
                              </div>
                              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                                <Progress value={done} max={a.quota} tone={done >= a.quota ? "success" : "primary"} className="min-w-[120px] flex-1" />
                                <span className="text-xs tabular-nums text-[var(--muted)]">
                                  {formatNumber(done)}/{formatNumber(a.quota)}
                                </span>
                              </div>
                              <div className="mt-2.5 flex flex-wrap items-end gap-2">
                                <form action={updateAssignmentAction} className="flex-1 space-y-2">
                                  <input type="hidden" name="id" value={a.id} />
                                  <ZoneQuotasFields
                                    initial={
                                      quotasByAssignment.get(a.id)?.map((q) => ({ zone: q.zone, quota: q.quota })) ??
                                      (a.zone ? [{ zone: a.zone, quota: a.quota }] : undefined)
                                    }
                                  />
                                  <button type="submit" className="h-8 rounded-lg px-3 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]">
                                    Guardar cuotas
                                  </button>
                                </form>
                                <form action={removeAssignmentAction}>
                                  <input type="hidden" name="id" value={a.id} />
                                  <button
                                    type="submit"
                                    aria-label="Quitar asignación"
                                    title="Quitar asignación (las entrevistas cargadas se conservan)"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </form>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-3 text-center text-xs text-[var(--muted)]">
                        Sin encuestas asignadas.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Card className="h-fit xl:sticky xl:top-6">
          <CardHeader>
            <div>
              <CardTitle>Asignar a una encuesta</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">El encuestador solo puede recibir encuestas de su organización.</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <AssignForm
              surveyors={surveyors
                .filter((s) => s.is_active)
                .map((s) => ({
                  id: s.id,
                  name: `${s.full_name} · ${orgName.get(s.organization_id ?? "") ?? "sin organización"}`,
                  organization_id: s.organization_id,
                  assigned: assignments.filter((a) => a.surveyor_id === s.id).map((a) => a.survey_id),
                }))}
              surveys={surveys
                .filter((s) => s.status !== "cerrada")
                .map((s) => ({
                  id: s.id,
                  title: s.title,
                  status: s.status,
                  organization_id: s.organization_id,
                  remaining: s.target_responses - (quotaBySurvey.get(s.id) ?? 0),
                }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-fg)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]",
      )}
    >
      {children}
    </Link>
  );
}
