import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ClipboardList, FolderKanban, MapPin, Users } from "lucide-react";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { SurveyStatusBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { requireOrganization } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Survey } from "@/lib/types";

export const metadata: Metadata = { title: "Encuestas" };

export default async function EncuestasPage() {
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const [{ data: surveyRows }, { data: responseRows }, { data: questionRows }, { data: assignRows }, { data: projectRows }] =
    await Promise.all([
      supabase
        .from("surveys")
        .select("*")
        .eq("organization_id", organization.id)
        .order("updated_at", { ascending: false }),
      fetchAll<{ survey_id: string; surveyor_id: string | null; submitted_at: string | null }>((from, to) =>
        supabase.from("responses")
        .select("survey_id")
        .eq("organization_id", organization.id)
        .eq("status", "completada")
        .order("id").range(from, to),
    ).then((data) => ({ data })),
      supabase.from("questions").select("survey_id"),
      supabase.from("survey_assignments").select("survey_id"),
      supabase.from("projects").select("id, name").eq("organization_id", organization.id),
    ]);

  const surveys = (surveyRows ?? []) as Survey[];
  const projectName = new Map((projectRows ?? []).map((p) => [p.id, p.name]));

  const tally = (rows: { survey_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) map.set(r.survey_id, (map.get(r.survey_id) ?? 0) + 1);
    return map;
  };

  const done = tally(responseRows);
  const questions = tally(questionRows);
  const assignments = tally(assignRows);

  const canManage = profile.role === "org_admin";

  return (
    <div className="space-y-7">
      <PageHeader
        title="Encuestas"
        description="Cada relevamiento con su cuestionario, su equipo de campo y sus resultados."
        actions={canManage ? <ButtonLink href="/cliente/encuestas/nueva">Nueva encuesta</ButtonLink> : null}
      />

      {surveys.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="Todavía no hay encuestas"
          description="Creá el cuestionario, definí la meta muestral y asigná a tus encuestadores."
          action={canManage ? <ButtonLink href="/cliente/encuestas/nueva">Crear encuesta</ButtonLink> : null}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {surveys.map((s) => {
            const completed = done.get(s.id) ?? 0;
            return (
              <article
                key={s.id}
                className="flex flex-col rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border))]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/cliente/encuestas/${s.id}`}
                      className="text-[15px] font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--primary)]"
                    >
                      {s.title}
                    </Link>
                    {s.description ? (
                      <p className="mt-1.5 line-clamp-2 text-sm text-[var(--muted)]">
                        {s.description}
                      </p>
                    ) : null}
                  </div>
                  <SurveyStatusBadge status={s.status} />
                </div>

                <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
                  {s.project_id && projectName.get(s.project_id) ? (
                    <div className="flex items-center gap-1.5">
                      <FolderKanban className="size-3.5" />
                      {projectName.get(s.project_id)}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="size-3.5" />
                    {formatNumber(questions.get(s.id) ?? 0)} preguntas
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {formatNumber(assignments.get(s.id) ?? 0)} encuestadores
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {s.geography ?? "Sin ámbito"}
                  </div>
                </dl>

                <div className="mt-5 flex items-center gap-3">
                  <Progress
                    value={completed}
                    max={s.target_responses}
                    tone={s.status === "activa" ? "primary" : "accent"}
                    className="flex-1"
                  />
                  <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                    {formatNumber(completed)}/{formatNumber(s.target_responses)}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <span className="text-xs text-[var(--muted)]">
                    Cierre: {formatDate(s.ends_at)}
                  </span>
                  <div className="flex gap-2">
                    <ButtonLink href={`/cliente/encuestas/${s.id}`} size="sm" variant="outline">
                      {canManage ? "Editar" : "Ver"}
                    </ButtonLink>
                    <ButtonLink href={`/cliente/encuestas/${s.id}/resultados`} size="sm">
                      <BarChart3 />
                      Resultados
                    </ButtonLink>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
