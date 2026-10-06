import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportForm } from "./report-form";
import { ReportLibrary } from "./library";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { requireOrganization } from "@/lib/auth";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { isDemoMode } from "@/lib/demo/mode";
import { toLibraryReport } from "@/lib/reports/library";
import { formatNumber } from "@/lib/utils";
import { type AiReport, type Survey } from "@/lib/types";

export const metadata: Metadata = { title: "Biblioteca de informes" };

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{ encuesta?: string }>;
}) {
  const { encuesta } = await searchParams;
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

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

  const canGenerate = profile.role === "org_admin";
  const writer = isGeminiConfigured() ? "gemini" : isDemoMode() ? "local" : "missing";

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
            Biblioteca
          </p>
        }
        title="Informes"
        description="Quedan guardados todos: los de encuesta y los del radar. Buscá por título, tema o fuente."
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

      <div className="grid gap-4 xl:grid-cols-5">
        <div className={canGenerate ? "xl:col-span-3" : "xl:col-span-5"}>
          <ReportLibrary reports={reports} canDelete={canGenerate} />
        </div>

        {canGenerate ? (
          <Card className="h-fit xl:col-span-2 xl:order-last">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[var(--accent)]" />
                <CardTitle>Nuevo informe de encuesta</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="mb-4 text-xs leading-relaxed text-[var(--muted)]">
                El del radar se pide desde Conversación. Este arma uno sobre una encuesta y también
                queda en la biblioteca.
              </p>
              <ReportForm surveys={surveys} defaultSurveyId={encuesta} writer={writer} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
