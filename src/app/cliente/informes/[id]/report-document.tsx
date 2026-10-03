import { Markdown } from "@/components/markdown";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils";
import {
  PAPER,
  PAPER_BARS,
  REPORT_PHOTOS,
  reportBodyMarkdown,
  type ReportChart,
} from "@/lib/reports/visual";
import type { ReportHighlight } from "@/lib/types";

export type ReportDocumentProps = {
  title: string;
  kindLabel: string;
  organizationName: string;
  createdAt: string;
  audience?: string | null;
  geography?: string | null;
  completed?: number;
  highlights: ReportHighlight[];
  charts: ReportChart[];
  markdown: string;
};

export function ReportDocument({
  title,
  kindLabel,
  organizationName,
  createdAt,
  audience,
  geography,
  completed,
  highlights,
  charts,
  markdown,
}: ReportDocumentProps) {
  const body = reportBodyMarkdown(markdown);
  const dateLabel = formatDate(createdAt);

  return (
    <article
      id="informe-documento"
      className="force-light overflow-hidden rounded-[28px] border border-[#e6ddd0] shadow-[0_24px_60px_-32px_rgba(40,28,12,0.35)]"
      style={{ background: PAPER.bg, color: PAPER.ink }}
    >
      <header className="relative isolate h-[320px] overflow-hidden sm:h-[360px]">
        <img
          src={REPORT_PHOTOS.cover}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1410] via-[#1a1410]/70 to-[#1a1410]/25" />
        <div className="absolute inset-x-0 bottom-0 p-7 sm:p-10">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-white/70 uppercase">
            {organizationName}
          </p>
          <h1 className="display mt-3 max-w-3xl text-[1.85rem] leading-[1.15] text-balance text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/75">
            <span>{kindLabel}</span>
            <span aria-hidden>·</span>
            <span>{dateLabel}</span>
            {geography ? (
              <>
                <span aria-hidden>·</span>
                <span>{geography}</span>
              </>
            ) : null}
            {completed ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatNumber(completed)} casos</span>
              </>
            ) : null}
          </p>
          {audience ? <p className="mt-2 text-xs text-white/60">Para {audience}</p> : null}
        </div>
      </header>

      {highlights.length ? (
        <section className="grid gap-3 p-6 sm:grid-cols-2 sm:p-9">
          {highlights.map((h, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#ece4d6] p-4"
              style={{ background: PAPER.card }}
            >
              {h.metrica ? (
                <p className="display text-2xl leading-none tabular-nums" style={{ color: PAPER.accent }}>
                  {h.metrica}
                </p>
              ) : null}
              <p className="mt-2 text-sm font-semibold">{h.titulo}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: PAPER.muted }}>
                {h.detalle}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <figure className="relative mx-6 overflow-hidden rounded-2xl sm:mx-9">
        <img src={REPORT_PHOTOS.mid} alt="" className="h-36 w-full object-cover sm:h-44" />
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-4 py-3 text-[11px] tracking-wide text-white/80">
          San Juan
        </figcaption>
      </figure>

      {charts.length ? (
        <section className="grid gap-6 p-6 sm:grid-cols-2 sm:p-9">
          {charts.map((chart) => (
            <PaperChart key={chart.title} chart={chart} />
          ))}
        </section>
      ) : null}

      {body ? (
        <section className="px-6 pb-4 sm:px-10">
          <Markdown>{body}</Markdown>
        </section>
      ) : null}

      <figure className="relative mt-4 overflow-hidden">
        <img src={REPORT_PHOTOS.close} alt="" className="h-40 w-full object-cover sm:h-48" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1410]/70 to-transparent" />
        <figcaption className="absolute inset-x-0 bottom-0 p-6 text-[11px] tracking-wide text-white/75 sm:p-8">
          Documento de uso interno · {organizationName} · {dateLabel}
        </figcaption>
      </figure>
    </article>
  );
}

function PaperChart({ chart }: { chart: ReportChart }) {
  return (
    <div className="rounded-2xl border border-[#ece4d6] p-5" style={{ background: PAPER.card }}>
      <h3 className="text-[15px] font-semibold leading-snug">{chart.title}</h3>
      {chart.caption ? (
        <p className="mt-1 text-[11px]" style={{ color: PAPER.muted }}>
          {chart.caption}
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {chart.rows.map((row, i) => {
          const width = Math.max(3, Math.min(100, row.percent));
          const color = PAPER_BARS[i % PAPER_BARS.length];
          const label =
            chart.unit === "score"
              ? row.value.toFixed(1).replace(".", ",")
              : formatPercent(row.percent);
          return (
            <li key={row.name}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate">{row.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{label}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#efe8dc]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${width}%`, background: color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
