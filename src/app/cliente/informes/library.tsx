"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search, Trash2 } from "lucide-react";
import { deleteReportAction } from "../actions";
import { Badge, ReportStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { filterLibrary, type LibraryReport, type ReportOrigin } from "@/lib/reports/library";
import { REPORT_KIND_LABEL } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const ORIGIN_LABEL: Record<"todos" | ReportOrigin, string> = {
  todos: "Todos",
  radar: "Radar",
  encuesta: "Encuestas",
};

export function ReportLibrary({
  reports,
  canDelete,
}: {
  reports: LibraryReport[];
  canDelete: boolean;
}) {
  const [q, setQ] = useState("");
  const [origin, setOrigin] = useState<"todos" | ReportOrigin>("todos");

  const counts = useMemo(
    () => ({
      todos: reports.length,
      radar: reports.filter((r) => r.origin === "radar").length,
      encuesta: reports.filter((r) => r.origin === "encuesta").length,
    }),
    [reports],
  );

  const visible = useMemo(() => filterLibrary(reports, q, origin), [reports, q, origin]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form
          className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <Search className="mr-2 size-4 shrink-0 text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, tema, encuesta o nota"
            className="h-full w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          />
        </form>
        <div className="flex h-11 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
          {(["todos", "radar", "encuesta"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setOrigin(key)}
              className={cn(
                "h-9 rounded-full px-3.5 text-xs font-semibold transition-colors",
                origin === key
                  ? "bg-[var(--foreground)] text-[var(--surface)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {ORIGIN_LABEL[key]}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title={reports.length ? "Nada con esa búsqueda" : "La biblioteca está vacía"}
          description={
            reports.length
              ? "Probá otro término o mirá todos los informes."
              : "Cada informe de encuesta o del radar queda guardado acá."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.id}>
              <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border))]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <ReportStatusBadge status={r.status} />
                      <Badge tone={r.origin === "radar" ? "accent" : "neutral"}>
                        {r.origin === "radar" ? "Radar" : "Encuesta"}
                      </Badge>
                      <Badge>{REPORT_KIND_LABEL[r.kind]}</Badge>
                    </div>
                    <Link
                      href={`/cliente/informes/${r.id}`}
                      className="text-[15px] font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--primary)]"
                    >
                      {r.title}
                    </Link>
                    <p suppressHydrationWarning className="mt-1 text-xs text-[var(--muted)]">
                      {r.originLabel} · {formatDateTime(r.createdAt)}
                      {r.audience ? ` · Para ${r.audience}` : ""}
                    </p>
                    {r.status === "error" && r.errorMessage ? (
                      <p className="mt-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                        {r.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  {canDelete ? (
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
                {r.highlights.length ? (
                  <ul className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
                    {r.highlights.slice(0, 4).map((h, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-medium text-[var(--foreground)]">{h.titulo}</p>
                        {h.metrica ? (
                          <p className="mt-0.5 text-xs font-medium text-[var(--primary)]">{h.metrica}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
