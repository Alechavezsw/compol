import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Eye } from "lucide-react";
import { DownloadPdfButton } from "./download-pdf";
import { ReportDocument } from "./report-document";
import { ButtonLink } from "@/components/ui/button";
import { PulseBoard } from "@/components/pulse/pulse-board";
import { LiveRefresh } from "@/components/results/live-refresh";
import { createClient } from "@/lib/supabase/server";
import { isClientReadOnly, requireClientViewer } from "@/lib/auth";
import { resolveClientOrganization, withOrg } from "@/lib/admin-org";
import { computeAnalytics, loadSurveyData } from "@/lib/analytics";
import { buildPulse } from "@/lib/pulse-build";
import { formatDate } from "@/lib/utils";
import { pickRadarCharts, pickReportCharts } from "@/lib/reports/visual";
import { computeSocial } from "@/lib/social/analytics";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { addDays, todayKey } from "@/lib/stats";
import { REPORT_KIND_LABEL, type AiReport, type SocialPost } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("ai_reports").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Informe" };
}

export default async function InformePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const { org } = await searchParams;
  const viewer = await requireClientViewer();
  const organization = await resolveClientOrganization(viewer, org);
  if (!organization) notFound();

  const supabase = await createClient();
  const readOnly = isClientReadOnly(viewer.profile.role) && !viewer.isCentralAdmin;
  const orgQs = viewer.isCentralAdmin ? organization.id : null;

  const { data } = await supabase
    .from("ai_reports")
    .select("*, surveys(id, title, geography, status, target_responses)")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!data) notFound();
  const report = data as AiReport & {
    surveys: {
      id: string;
      title: string;
      geography: string | null;
      status: string;
      target_responses: number;
    } | null;
  };

  let charts = [] as ReturnType<typeof pickReportCharts>;
  let completed = 0;
  let geography = report.surveys?.geography ?? null;
  let sampleLabel = "casos";
  const isRadar = !report.survey_id || report.focus?.startsWith("radar");
  let pulse = null as ReturnType<typeof buildPulse>;

  if (report.surveys && report.status === "listo") {
    const surveyData = await loadSurveyData(supabase, report.surveys.id);
    if (surveyData) {
      const analytics = computeAnalytics(surveyData);
      charts = pickReportCharts(analytics);
      completed = analytics.totals.completed;
      geography = analytics.survey.geography;
      pulse = buildPulse(surveyData);
    }
  } else if (isRadar && report.status === "listo") {
    const today = todayKey();
    const days = Number(report.focus?.split(":")[1] ?? 30);
    const window = [1, 7, 30].includes(days) ? days : 30;
    const posts = await fetchAll<SocialPost>((from, to) =>
      supabase
        .from("social_posts")
        .select("*")
        .eq("organization_id", organization.id)
        .gte("published_at", new Date(`${addDays(today, -30)}T00:00:00-03:00`).toISOString())
        .order("id")
        .range(from, to),
    );
    const social = computeSocial(posts, { days: window }, today);
    charts = pickRadarCharts(social);
    completed = social.total;
    geography = "Radar de conversación";
    sampleLabel = "notas";
  }

  const kindLabel = isRadar ? "Informe del radar" : REPORT_KIND_LABEL[report.kind];
  const dateLabel = formatDate(report.created_at);
  const liveSurvey = report.surveys?.status === "activa";

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-[880px] space-y-6">
        <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
          <Link
            href={withOrg("/cliente/informes", orgQs)}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="size-4" />
            Volver a la biblioteca
          </Link>
          <div className="flex flex-wrap gap-2">
            {report.surveys ? (
              <ButtonLink
                href={`/cliente/encuestas/${report.surveys.id}/resultados`}
                variant="outline"
                size="sm"
              >
                <BarChart3 />
                Resultados en vivo
              </ButtonLink>
            ) : isRadar ? (
              <ButtonLink href={withOrg("/cliente/redes", orgQs)} variant="outline" size="sm">
                <BarChart3 />
                Volver al radar
              </ButtonLink>
            ) : null}
            {report.status === "listo" ? (
              <DownloadPdfButton
                payload={{
                  title: report.title,
                  kindLabel,
                  organizationName: organization.name,
                  dateLabel,
                  audience: report.audience,
                  geography,
                  completed,
                  sampleLabel,
                  highlights: report.highlights ?? [],
                  charts,
                  markdown: report.content ?? "",
                }}
              />
            ) : null}
          </div>
        </div>

        {readOnly ? (
          <div className="print-hidden flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--primary-soft)_45%,var(--surface))] p-4 text-sm text-[var(--foreground)]">
            <Eye className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" />
            <p>Documento de solo lectura. Incluye el análisis y, debajo, el mapa con los datos al día.</p>
          </div>
        ) : null}

        {report.status === "error" ? (
          <div className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
            <p className="font-semibold">No se pudo generar el informe.</p>
            <p className="mt-1">{report.error_message ?? "Error desconocido."}</p>
          </div>
        ) : report.status === "generando" ? (
          <p className="py-16 text-center text-sm text-[var(--muted)]">
            El informe se está generando. Recargá la página en unos segundos.
          </p>
        ) : (
          <ReportDocument
            title={report.title}
            kindLabel={kindLabel}
            organizationName={organization.name}
            createdAt={report.created_at}
            audience={report.audience}
            geography={geography}
            completed={completed}
            sampleLabel={sampleLabel}
            highlights={report.highlights ?? []}
            charts={charts}
            markdown={report.content ?? ""}
          />
        )}
      </div>

      {pulse && report.status === "listo" ? (
        <section aria-labelledby="mapa-informe" className="print-hidden space-y-4">
          {liveSurvey ? <LiveRefresh intervalMs={45_000} /> : null}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="mapa-informe" className="display text-3xl text-[var(--foreground)]">
                Resultados en tiempo real
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Mapa y pulso del operativo vinculado a este informe
                {liveSurvey ? " · se actualiza solo" : ""}.
              </p>
            </div>
            {report.surveys ? (
              <Link
                href={`/cliente/encuestas/${report.surveys.id}/resultados`}
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                Abrir tablero completo
              </Link>
            ) : null}
          </div>
          <PulseBoard
            key={report.surveys?.id}
            data={pulse}
            social={[]}
            target={report.surveys?.target_responses ?? 0}
          />
        </section>
      ) : null}
    </div>
  );
}
