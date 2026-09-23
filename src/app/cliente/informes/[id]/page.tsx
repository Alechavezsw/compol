import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { PrintButton } from "./print-button";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, ReportStatusBadge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { REPORT_KIND_LABEL, type AiReport } from "@/lib/types";

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
    .select("*, surveys(id, title)")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!data) notFound();
  const report = data as AiReport & { surveys: { id: string; title: string } | null };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/cliente/informes"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" />
          Volver a informes
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
          ) : null}
          {report.status === "listo" ? <PrintButton /> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ReportStatusBadge status={report.status} />
        <Badge tone="accent">{REPORT_KIND_LABEL[report.kind]}</Badge>
        {report.model ? <Badge tone="neutral">{report.model}</Badge> : null}
        <span className="text-xs text-[var(--muted)]">{formatDateTime(report.created_at)}</span>
      </div>

      {report.highlights?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {report.highlights.map((h, i) => (
            <Card key={i} className="border-l-2 border-l-[var(--primary)]">
              <CardContent className="p-4">
                {h.metrica ? (
                  <p className="text-lg font-semibold tabular-nums text-[var(--primary)]">
                    {h.metrica}
                  </p>
                ) : null}
                <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{h.titulo}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{h.detalle}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-6 sm:p-9">
          {report.status === "error" ? (
            <div className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
              <p className="font-semibold">No se pudo generar el informe.</p>
              <p className="mt-1">{report.error_message ?? "Error desconocido."}</p>
            </div>
          ) : report.status === "generando" ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              El informe se está generando. Recargá la página en unos segundos.
            </p>
          ) : (
            <Markdown>{report.content ?? ""}</Markdown>
          )}
        </CardContent>
      </Card>

      <p className="print-hidden pb-4 text-center text-xs text-[var(--muted)]">
        «Imprimir / PDF» genera un documento limpio, sin menús ni fondos, listo para enviar.
      </p>
    </div>
  );
}
