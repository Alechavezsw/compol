"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GRAN_SAN_JUAN_QUOTAS } from "@/lib/san-juan-zones";
import { Input } from "@/components/ui/field";

export function ZoneQuotasFields({
  initial = GRAN_SAN_JUAN_QUOTAS,
}: {
  initial?: { zone: string; quota: number }[];
}) {
  const [rows, setRows] = useState(initial.length ? initial : [{ zone: "", quota: 10 }]);
  const total = rows.reduce((sum, r) => sum + (Number.isFinite(r.quota) ? r.quota : 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[var(--foreground)]">Cuotas por departamento</p>
        <p className="text-xs tabular-nums text-[var(--muted)]">Total {total}</p>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          <Input
            name="zones"
            value={row.zone}
            onChange={(e) =>
              setRows((prev) => prev.map((r, j) => (j === i ? { ...r, zone: e.target.value } : r)))
            }
            placeholder="Capital"
            maxLength={80}
            required
            className="flex-1"
          />
          <Input
            name="quotas"
            type="number"
            min={1}
            max={5000}
            value={row.quota}
            onChange={(e) =>
              setRows((prev) => prev.map((r, j) => (j === i ? { ...r, quota: Number(e.target.value) } : r)))
            }
            required
            className="w-24"
          />
          {rows.length > 1 ? (
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              aria-label="Quitar zona"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { zone: "", quota: 10 }])}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)]"
      >
        <Plus className="size-3.5" />
        Agregar departamento
      </button>
    </div>
  );
}
