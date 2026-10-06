import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { DownloadPdfButton } from "./download-pdf";
import { ReportDocument } from "./report-document";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { computeAnalytics, loadSurveyData } from "@/lib/analytics";
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

export default async function InformePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("ai_reports")
    .select("*, surveys(id, title, geography)")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!data) notFound();
  const report = data as AiReport & { surveys: { id: string; title: string; geography: string | null } | null };

  let charts = [] as ReturnType<typeof pickReportCharts>;
  let completed = 0;
  let geography = report.surveys?.geography ?? null;
  let sampleLabel = "casos";
  const isRadar = !report.survey_id || report.focus?.startsWith("radar");

  if (report.surveys && report.status === "listo") {
    const surveyData = await loadSurveyData(supabase, report.surveys.id);
    if (surveyData) {
      const analytics = computeAnalytics(surveyData);
      charts = pickReportCharts(analytics);
      completed = analytics.totals.completed;
      geography = analytics.survey.geography;
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

  return (
    <div className="mx-auto max-w-[880px] space-y-6">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/cliente/informes"
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
              Ver los datos
            </ButtonLink>
          ) : isRadar ? (
            <ButtonLink href="/cliente/redes" variant="outline" size="sm">
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
  );
}
