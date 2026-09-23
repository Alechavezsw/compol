import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { applyFilters, loadSurveyData } from "@/lib/analytics";
import { filtersFromParams } from "@/lib/filters";
import { describeAnswer, resolvePath } from "@/lib/survey-logic";
import { dayKey, TIME_ZONE } from "@/lib/stats";
import { slugify } from "@/lib/utils";

/**
 * Base de microdatos en CSV: una fila por entrevista, una columna por pregunta
 * y, en opción múltiple, una columna 1/0 por opción (el formato que esperan
 * SPSS, R o una tabla dinámica). Separador `;` y BOM para que Excel en
 * español lo abra sin asistente de importación.
 *
 * Celda vacía = no se le hizo la pregunta. Así se distingue "no aplica" de
 * "respondió que no", que en una base de encuestas no es lo mismo.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const data = await loadSurveyData(supabase, id);
  if (!data || data.survey.organization_id !== organization.id) {
    return new Response("Encuesta no encontrada", { status: 404 });
  }

  const url = new URL(request.url);
  const filters = filtersFromParams(url.searchParams);
  const includeDiscarded = url.searchParams.get("incluir") === "descartadas";

  const time = new Intl.DateTimeFormat("es-AR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const rows = applyFilters(data, data.responses, filters)
    .filter((r) => r.status === "completada" || (includeDiscarded && r.status === "descartada"))
    .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));

  const header = ["id_entrevista", "estado", "fecha", "hora", "zona", "encuestador", "duracion_seg"];
  for (const q of data.questions) {
    if (q.type === "opcion_multiple") {
      for (const o of q.options) header.push(`P${q.position}_${slugify(o.label).slice(0, 24)}`);
    } else {
      header.push(`P${q.position}`);
    }
  }

  const escape = (value: string | number | null | undefined) => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [header.map(escape).join(";")];

  // Segunda fila con los enunciados: quien abre la base en Excel sabe qué es cada P.
  const labels = ["", "", "", "", "", "", ""];
  for (const q of data.questions) {
    if (q.type === "opcion_multiple") for (const o of q.options) labels.push(`${q.text} — ${o.label}`);
    else labels.push(q.text);
  }
  lines.push(labels.map(escape).join(";"));

  for (const r of rows) {
    const answers = data.values.get(r.id) ?? {};
    const asked = new Set(resolvePath(data.questions, answers).path.map((q) => q.id));
    const cells: (string | number | null)[] = [
      r.id,
      r.status,
      r.submitted_at ? dayKey(r.submitted_at) : "",
      r.submitted_at ? time.format(new Date(r.submitted_at)) : "",
      r.zone ?? "",
      r.surveyor_id ? (data.names.get(r.surveyor_id) ?? r.surveyor_id) : "",
      r.duration_seconds ?? "",
    ];

    for (const q of data.questions) {
      const v = answers[q.id];
      if (q.type === "opcion_multiple") {
        for (const o of q.options) {
          cells.push(asked.has(q.id) && v ? ((v.optionIds ?? []).includes(o.id) ? 1 : 0) : "");
        }
      } else if (q.type === "escala" || q.type === "numero") {
        cells.push(typeof v?.number === "number" ? String(v.number).replace(".", ",") : "");
      } else {
        cells.push(describeAnswer(q, v));
      }
    }
    lines.push(cells.map(escape).join(";"));
  }

  const filename = `${slugify(data.survey.title) || "encuesta"}-${dayKey(Date.now())}.csv`;
  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
