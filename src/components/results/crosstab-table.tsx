import { ArrowDown, ArrowUp, Info } from "lucide-react";
import type { Crosstab } from "@/lib/analytics";
import { cn, formatNumber } from "@/lib/utils";

const pct = (n: number) => `${n.toFixed(0)}%`;

/**
 * Tabla de cruce con mapa de calor. La intensidad sale del porcentaje de la
 * celda; las flechas marcan diferencias significativas al 95% contra el resto
 * de la muestra, que es lo que un analista necesita para no leer ruido.
 */
export function CrosstabTable({ ct }: { ct: Crosstab }) {
  const maxPercent = Math.max(1, ...ct.rows.flatMap((r) => r.cells.map((c) => c.percent)));

  return (
    <div className="space-y-4">
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-[34%] px-2 pb-2 text-left align-bottom text-xs font-medium text-[var(--muted)]">
                {ct.multiple ? "Menciones (% de cada columna)" : "% de cada columna"}
              </th>
              <th className="px-2 pb-2 text-right align-bottom text-xs font-semibold text-[var(--foreground)]">
                Total
                <span className="block font-normal text-[var(--muted)]">n={formatNumber(ct.totalBase)}</span>
              </th>
              {ct.columns.map((c) => (
                <th key={c.key} className="px-2 pb-2 text-right align-bottom text-xs font-semibold text-[var(--foreground)]">
                  <span className="line-clamp-2">{c.label}</span>
                  <span className={cn("block font-normal", c.small ? "text-[var(--warning)]" : "text-[var(--muted)]")}>
                    n={formatNumber(c.base)}
                    {c.small ? " ⚠" : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ct.rows.map((row) => (
              <tr key={row.key}>
                <td className="rounded-lg px-2 py-2 text-[var(--foreground)]">{row.label}</td>
                <td className="rounded-lg bg-[var(--surface-2)] px-2 py-2 text-right font-semibold tabular-nums text-[var(--foreground)]">
                  {pct(row.total.percent)}
                </td>
                {row.cells.map((cell, j) => {
                  const small = ct.columns[j].small;
                  const alpha = Math.round((cell.percent / maxPercent) * 42) + 4;
                  return (
                    <td
                      key={ct.columns[j].key}
                      className={cn(
                        "rounded-lg px-2 py-2 text-right tabular-nums",
                        small ? "text-[var(--muted)]" : "text-[var(--foreground)]",
                        cell.sig !== 0 && "font-semibold",
                      )}
                      style={{
                        background: `color-mix(in oklab, var(--primary) ${small ? Math.round(alpha / 2) : alpha}%, transparent)`,
                        boxShadow:
                          cell.sig === 1
                            ? "inset 0 0 0 1.5px var(--success)"
                            : cell.sig === -1
                              ? "inset 0 0 0 1.5px var(--danger)"
                              : undefined,
                      }}
                      title={`${formatNumber(cell.value)} casos · z=${cell.z.toFixed(2)}`}
                    >
                      <span className="inline-flex items-center justify-end gap-0.5">
                        {cell.sig === 1 ? <ArrowUp className="size-3 text-[var(--success)]" /> : null}
                        {cell.sig === -1 ? <ArrowDown className="size-3 text-[var(--danger)]" /> : null}
                        {pct(cell.percent)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {ct.means ? (
              <tr>
                <td className="px-2 py-2 text-xs font-medium text-[var(--muted)]">Promedio</td>
                <td className="px-2 py-2" />
                {ct.means.map((m, j) => (
                  <td key={ct.columns[j].key} className="px-2 py-2 text-right text-sm font-semibold tabular-nums">
                    {m === null ? "—" : m.toFixed(2).replace(".", ",")}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <ArrowUp className="size-3 text-[var(--success)]" />
          <ArrowDown className="size-3 text-[var(--danger)]" />
          Diferencia significativa contra el resto (95%)
        </span>
        <span>⚠ Base menor a 30: leer con cautela</span>
        {ct.test ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium",
              ct.test.pValue < 0.05
                ? "bg-[var(--success-soft)] text-[var(--success)]"
                : "bg-[var(--surface-2)] text-[var(--muted)]",
            )}
          >
            <Info className="size-3" />
            {ct.test.pValue < 0.05
              ? `Asociación significativa (χ² p ${ct.test.pValue < 0.001 ? "< 0,001" : `= ${ct.test.pValue.toFixed(3).replace(".", ",")}`}, V de Cramér ${ct.test.cramersV.toFixed(2).replace(".", ",")})`
              : `Sin asociación significativa (χ² p = ${ct.test.pValue.toFixed(2).replace(".", ",")})`}
          </span>
        ) : ct.multiple ? (
          <span>Respuesta múltiple: se testea cada celda por separado.</span>
        ) : null}
      </div>
    </div>
  );
}
