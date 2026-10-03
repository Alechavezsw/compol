"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { slugify } from "@/lib/utils";
import {
  PAPER,
  PAPER_BARS,
  REPORT_PHOTOS,
  markdownToSections,
  type ReportChart,
} from "@/lib/reports/visual";
import type { ReportHighlight } from "@/lib/types";

type Payload = {
  title: string;
  kindLabel: string;
  organizationName: string;
  dateLabel: string;
  audience?: string | null;
  geography?: string | null;
  completed?: number;
  highlights: ReportHighlight[];
  charts: ReportChart[];
  markdown: string;
};

const MARGIN = 16;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT = PAGE_W - MARGIN * 2;

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

async function dataUrl(src: string) {
  const res = await fetch(src);
  if (!res.ok) throw new Error("No se pudo leer la foto del informe.");
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la foto del informe."));
    reader.readAsDataURL(blob);
  });
}

export function DownloadPdfButton({ payload }: { payload: Payload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    setBusy(true);
    setError(null);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
      const [cover, mid, close] = await Promise.all([
        dataUrl(REPORT_PHOTOS.cover),
        dataUrl(REPORT_PHOTOS.mid),
        dataUrl(REPORT_PHOTOS.close),
      ]);

      const paintBg = () => {
        const [r, g, b] = hexToRgb(PAPER.bg);
        pdf.setFillColor(r, g, b);
        pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
      };

      paintBg();
      pdf.addImage(cover, "JPEG", 0, 0, PAGE_W, 92, undefined, "FAST");
      pdf.setFillColor(18, 14, 12);
      pdf.setGState(pdf.GState({ opacity: 0.42 }));
      pdf.rect(0, 0, PAGE_W, 92, "F");
      pdf.setGState(pdf.GState({ opacity: 1 }));

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(payload.organizationName.toUpperCase(), MARGIN, 58);
      pdf.setFont("times", "bold");
      pdf.setFontSize(20);
      const titleLines = pdf.splitTextToSize(payload.title, CONTENT);
      pdf.text(titleLines, MARGIN, 68);

      const meta = [
        payload.kindLabel,
        payload.dateLabel,
        payload.geography,
        payload.completed ? `${payload.completed} casos` : null,
      ]
        .filter(Boolean)
        .join("  ·  ");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(meta, MARGIN, 68 + titleLines.length * 8);

      let y = 104;
      const ink = hexToRgb(PAPER.ink);
      const muted = hexToRgb(PAPER.muted);
      const line = hexToRgb(PAPER.line);
      const accent = hexToRgb(PAPER.accent);

      const ensure = (need: number) => {
        if (y + need < PAGE_H - 16) return;
        pdf.addPage();
        paintBg();
        y = 18;
      };

      if (payload.highlights.length) {
        const colW = (CONTENT - 4) / 2;
        for (let i = 0; i < payload.highlights.length; i += 2) {
          const pair = payload.highlights.slice(i, i + 2);
          ensure(36);
          pair.forEach((h, idx) => {
            const x = MARGIN + idx * (colW + 4);
            pdf.setDrawColor(...line);
            pdf.setFillColor(255, 253, 248);
            pdf.roundedRect(x, y, colW, 32, 2, 2, "FD");
            if (h.metrica) {
              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(11);
              pdf.setTextColor(...accent);
              pdf.text(pdf.splitTextToSize(h.metrica, colW - 8)[0], x + 4, y + 8);
            }
            pdf.setTextColor(...ink);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9);
            pdf.text(pdf.splitTextToSize(h.titulo, colW - 8).slice(0, 2), x + 4, y + 14);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(...muted);
            pdf.setFontSize(8);
            pdf.text(pdf.splitTextToSize(h.detalle, colW - 8).slice(0, 3), x + 4, y + 21);
          });
          y += 38;
        }
      }

      ensure(42);
      pdf.addImage(mid, "JPEG", MARGIN, y, CONTENT, 28, undefined, "FAST");
      pdf.setFillColor(18, 14, 12);
      pdf.setGState(pdf.GState({ opacity: 0.28 }));
      pdf.rect(MARGIN, y + 20, CONTENT, 8, "F");
      pdf.setGState(pdf.GState({ opacity: 1 }));
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.text("San Juan", MARGIN + 3, y + 25);
      y += 34;

      for (const chart of payload.charts) {
        const block = 16 + chart.rows.length * 8;
        ensure(block);
        pdf.setTextColor(...ink);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(pdf.splitTextToSize(chart.title, CONTENT), MARGIN, y);
        y += 6;
        if (chart.caption) {
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...muted);
          pdf.setFontSize(8);
          pdf.text(chart.caption, MARGIN, y);
          y += 5;
        }
        for (const [i, row] of chart.rows.entries()) {
          ensure(10);
          const barW = Math.max(4, (CONTENT * Math.min(100, row.percent)) / 100);
          const [r, g, b] = hexToRgb(PAPER_BARS[i % PAPER_BARS.length]);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(...ink);
          pdf.text(row.name.slice(0, 48), MARGIN, y);
          const label = chart.unit === "score" ? row.value.toFixed(1).replace(".", ",") : `${row.percent.toFixed(1).replace(".", ",")}%`;
          pdf.setFont("helvetica", "bold");
          pdf.text(label, PAGE_W - MARGIN, y, { align: "right" });
          y += 1.6;
          pdf.setFillColor(239, 232, 220);
          pdf.roundedRect(MARGIN, y, CONTENT, 1.6, 0.4, 0.4, "F");
          pdf.setFillColor(r, g, b);
          pdf.roundedRect(MARGIN, y, barW, 1.6, 0.4, 0.4, "F");
          y += 6.2;
        }
        y += 4;
      }

      for (const section of markdownToSections(payload.markdown)) {
        if (section.title) {
          ensure(16);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          pdf.setTextColor(...ink);
          pdf.text(section.title, MARGIN, y);
          y += 2;
          pdf.setDrawColor(...line);
          pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
          y += 6;
        }
        if (!section.text) continue;
        pdf.setFont("times", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(...ink);
        const lines = pdf.splitTextToSize(section.text, CONTENT) as string[];
        for (const line of lines) {
          ensure(6);
          pdf.text(line, MARGIN, y);
          y += 5;
        }
        y += 4;
      }

      ensure(46);
      pdf.addImage(close, "JPEG", 0, y, PAGE_W, 40, undefined, "FAST");
      pdf.setFillColor(18, 14, 12);
      pdf.setGState(pdf.GState({ opacity: 0.4 }));
      pdf.rect(0, y, PAGE_W, 40, "F");
      pdf.setGState(pdf.GState({ opacity: 1 }));
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(
        `Documento de uso interno · ${payload.organizationName} · ${payload.dateLabel}`,
        MARGIN,
        y + 34,
      );

      const pages = pdf.getNumberOfPages();
      for (let p = 1; p <= pages; p += 1) {
        pdf.setPage(p);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...muted);
        pdf.text(`${p} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
      }

      pdf.save(`${slugify(payload.title) || "informe"}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo armar el PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDownload}
        disabled={busy}
        className="inline-flex h-8 items-center gap-2 rounded-xl bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-fg)] transition-all hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {busy ? "Armando PDF…" : "Descargar PDF"}
      </button>
      {error ? <p className="max-w-64 text-right text-[11px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
