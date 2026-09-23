"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-8 items-center gap-2 rounded-xl bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-fg)] transition-all hover:brightness-110"
    >
      <Printer className="size-4" />
      Imprimir / PDF
    </button>
  );
}
