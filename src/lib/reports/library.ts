import { REPORT_KIND_LABEL, type AiReport, type ReportKind, type ReportStatus } from "@/lib/types";

export type ReportOrigin = "radar" | "encuesta";

export type LibraryReport = {
  id: string;
  title: string;
  kind: ReportKind;
  status: ReportStatus;
  origin: ReportOrigin;
  originLabel: string;
  audience: string | null;
  createdAt: string;
  highlights: AiReport["highlights"];
  errorMessage: string | null;
  haystack: string;
};

export function isRadarReport(report: Pick<AiReport, "survey_id" | "focus">) {
  return !report.survey_id || Boolean(report.focus?.startsWith("radar"));
}

export function toLibraryReport(
  report: AiReport & { surveys: { title: string } | null },
): LibraryReport {
  const origin: ReportOrigin = isRadarReport(report) ? "radar" : "encuesta";
  const originLabel =
    origin === "radar" ? "Radar de conversación" : report.surveys?.title || "Encuesta";
  const highlightText = (report.highlights ?? [])
    .flatMap((h) => [h.titulo, h.detalle, h.metrica ?? ""])
    .join(" ");
  return {
    id: report.id,
    title: report.title,
    kind: report.kind,
    status: report.status,
    origin,
    originLabel,
    audience: report.audience,
    createdAt: report.created_at,
    highlights: report.highlights ?? [],
    errorMessage: report.error_message,
    haystack: [
      report.title,
      originLabel,
      REPORT_KIND_LABEL[report.kind],
      report.audience ?? "",
      report.focus ?? "",
      highlightText,
      report.content ?? "",
    ]
      .join(" ")
      .toLowerCase(),
  };
}

export function filterLibrary(reports: LibraryReport[], q: string, origin: "todos" | ReportOrigin) {
  const needle = q.trim().toLowerCase();
  return reports.filter((r) => {
    if (origin !== "todos" && r.origin !== origin) return false;
    if (!needle) return true;
    return r.haystack.includes(needle);
  });
}
