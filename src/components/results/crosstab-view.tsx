"use client";

import { useState } from "react";
import { LikertBars, ToneLegend, type LikertRow } from "@/components/pulse/bars";
import { Segmented } from "@/components/pulse/segmented";

/** El cruce como dibujo o como tabla. La tabla (que llega ya armada) trae la significancia celda por celda. */
export function CrosstabView({ rows, children }: { rows: LikertRow[]; children: React.ReactNode }) {
  const [view, setView] = useState<"grafico" | "tabla">("grafico");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {view === "grafico" && rows.length ? <ToneLegend shares={rows[0].shares} /> : <span />}
        <Segmented
          label="Cómo ver el cruce"
          value={view}
          options={[
            { value: "grafico", label: "Gráfico" },
            { value: "tabla", label: "Tabla" },
          ]}
          onChange={setView}
        />
      </div>
      {view === "grafico" ? <LikertBars rows={rows} /> : children}
    </div>
  );
}
