import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Sparkles, Trash2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ReportStatusBadge } from "@/components/ui/badge";
import { ReportForm } from "./report-form";
import { deleteReportAction } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { requireOrganization } from "@/lib/auth";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { isDemoMode } from "@/lib/demo/mode";
import { formatDateTime } from "@/lib/utils";
import { REPORT_KIND_LABEL, type AiReport, type Survey } from "@/lib/types";

export const metadata: Metadata = { title: "Informes IA" };

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{ encuesta?: string }>;
}) {
  const { encuesta } = await searchParams;
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const [{ data: reportRows }, { data: surveyRows }, { data: responseRows }] = await Promise.all([
    supabase
      .from("ai_reports")
      .select("*, surveys(title)")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("surveys")
      .select("id, title")
      .eq("organization_id", organization.id)
      .order("updated_at", { ascending: false }),
    fetchAll<{ survey_id: string; surveyor_id: string | null; submitted_at: string | null }>((from, to) =>
      supabase.from("responses")
      .select("survey_id")
      .eq("organization_id", organization.id)
      .eq("status", "completada")
      .order("id").range(from, to),
    ).then((data) => ({ data })),
  ]);

  const reports = (reportRows ?? []) as (AiReport & { surveys: { title: string } | null })[];

  const counts = new Map<string, number>();
  for (const r of responseRows ?? []) counts.set(r.survey_id, (counts.get(r.survey_id) ?? 0) + 1);

  const surveys = ((surveyRows ?? []) as Pick<Survey, "id" | "title">[]).map((s) => ({
    id: s.id,
    title: s.title,
    completed: counts.get(s.id) ?? 0,
  }));

  const canGenerate = profile.role === "org_admin";
  const writer = isGeminiConfigured() ? "gemini" : isDemoMode() ? "local" : "missing";

  return (
    <div className="space-y-7">
      <PageHeader
        title="Informes con IA"
        description="Gemini redacta el documento sobre los agregados reales del relevamiento: porcentajes, bases muestrales y textuales."
      />

      <div className="grid gap-4 xl:grid-cols-5">
        {canGenerate ? (
          <Card className="xl:col-span-2 xl:order-last h-fit">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[var(--accent)]" />
                <CardTitle>Nuevo informe</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <ReportForm surveys={surveys} defaultSurveyId={encuesta} writer={writer} />
            </CardContent>
          </Card>
        ) : null}

        <div className={canGenerate ? "space-y-3 xl:col-span-3" : "space-y-3 xl:col-span-5"}>
          {reports.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-5" />}
              title="Todavía no hay informes"
              description={
                canGenerate
                  ? "Elegí una encuesta con datos cargados y pedí el primer informe."
                  : "Cuando la administración de tu organización genere informes, van a aparecer acá."
              }
            />
          ) : (
            reports.map((r) => (
              <article
                key={r.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border))]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <ReportStatusBadge status={r.status} />
                      <Badge tone="accent">{REPORT_KIND_LABEL[r.kind]}</Badge>
                      {r.model ? <Badge tone="neutral">{r.model}</Badge> : null}
                    </div>
                    <Link
                      href={`/cliente/informes/${r.id}`}
                      className="text-[15px] font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--primary)]"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {r.surveys?.title ?? "Encuesta eliminada"} · {formatDateTime(r.created_at)}
                    </p>
                    {r.status === "error" && r.error_message ? (
                      <p className="mt-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                        {r.error_message}
                      </p>
                    ) : null}
                  </div>

                  {canGenerate ? (
                    <form action={deleteReportAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        aria-label="Eliminar informe"
                        className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  ) : null}
                </div>

                {r.highlights?.length ? (
                  <ul className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
                    {r.highlights.slice(0, 4).map((h, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-medium text-[var(--foreground)]">{h.titulo}</p>
                        {h.metrica ? (
                          <p className="mt-0.5 text-xs font-medium text-[var(--primary)]">
                            {h.metrica}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
