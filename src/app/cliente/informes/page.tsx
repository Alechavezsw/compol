import type { Metadata } from "next";
import { Eye, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportForm } from "./report-form";
import { ReportLibrary } from "./library";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { canManage, isClientReadOnly, requireClientViewer } from "@/lib/auth";
import { listOrganizationsForPicker, resolveClientOrganization } from "@/lib/admin-org";
import { AdminOrgPicker } from "@/components/admin-org-picker";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { isDemoMode } from "@/lib/demo/mode";
import { toLibraryReport } from "@/lib/reports/library";
import { formatNumber } from "@/lib/utils";
import { type AiReport, type Survey } from "@/lib/types";

export const metadata: Metadata = { title: "Biblioteca de informes" };

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{ encuesta?: string; org?: string }>;
}) {
  const { encuesta, org } = await searchParams;
  const viewer = await requireClientViewer();
  const organization = await resolveClientOrganization(viewer, org);
  if (!organization) {
    return (
      <AdminOrgPicker
        title="Biblioteca de informes"
        description="Elegí el organismo. Acá se generan los informes que después lee el Político."
        nextPath="/cliente/informes"
        organizations={await listOrganizationsForPicker()}
      />
    );
  }
  const { profile, isCentralAdmin } = viewer;
  const supabase = await createClient();
  const readOnly = isClientReadOnly(profile.role) && !isCentralAdmin;
  const canGenerate = canManage(profile.role) || isCentralAdmin;

  const [reportRows, { data: surveyRows }, responseRows] = await Promise.all([
    fetchAll<AiReport & { surveys: { title: string } | null }>((from, to) =>
      supabase
        .from("ai_reports")
        .select("*, surveys(title)")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("surveys")
      .select("id, title")
      .eq("organization_id", organization.id)
      .order("updated_at", { ascending: false }),
    fetchAll<{ survey_id: string }>((from, to) =>
      supabase
        .from("responses")
        .select("survey_id")
        .eq("organization_id", organization.id)
        .eq("status", "completada")
        .order("id")
        .range(from, to),
    ),
  ]);

  const reports = reportRows.map(toLibraryReport);
  const counts = new Map<string, number>();
  for (const r of responseRows) counts.set(r.survey_id, (counts.get(r.survey_id) ?? 0) + 1);

  const surveys = ((surveyRows ?? []) as Pick<Survey, "id" | "title">[]).map((s) => ({
    id: s.id,
    title: s.title,
    completed: counts.get(s.id) ?? 0,
  }));

  const writer = isGeminiConfigured() ? "gemini" : isDemoMode() ? "local" : "missing";

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
            {readOnly ? "Lectura política" : "Producción de informes"}
          </p>
        }
        title={readOnly ? "Informes para tu lectura" : "Biblioteca de informes"}
        description={
          readOnly
            ? "Documentos preparados por el equipo técnico: lectura detallada, mapas y resultados al día."
            : "Acá se generan los informes que después ve el Político en solo lectura: con mapa, gráficos y datos en vivo."
        }
        actions={
          <p className="text-sm text-[var(--muted)]">
            <span className="display text-[28px] leading-none text-[var(--foreground)] tabular-nums">
              {formatNumber(reports.length)}
            </span>
            <span className="mt-1 block text-[11px]">
              {reports.length === 1 ? "informe guardado" : "informes guardados"}
            </span>
          </p>
        }
      />

      {readOnly ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--primary-soft)_45%,var(--surface))] p-4 text-sm text-[var(--foreground)]">
          <Eye className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" />
          <p>
            Modo solo lectura. Si necesitás un informe nuevo o más detalle, pedíselo a quien administra el
            operativo.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className={canGenerate ? "xl:col-span-3" : "xl:col-span-5"}>
          <ReportLibrary
            reports={reports}
            canDelete={canGenerate}
            orgId={isCentralAdmin ? organization.id : null}
          />
        </div>

        {canGenerate ? (
          <Card className="h-fit xl:col-span-2 xl:order-last">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[var(--accent)]" />
                <CardTitle>Generar informe</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="mb-4 text-xs leading-relaxed text-[var(--muted)]">
                Sale con tapa, hallazgos, gráficos, mapa territorial y enlace a resultados en vivo. El
                Político lo ve en la biblioteca sin poder editarlo.
              </p>
              <ReportForm
                surveys={surveys}
                defaultSurveyId={encuesta}
                writer={writer}
                organizationId={organization.id}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
