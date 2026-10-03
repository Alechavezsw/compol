import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { PageHeader, EmptyState, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice } from "@/lib/types";
import { updateInvoiceStatusAction } from "../actions";

export const metadata: Metadata = { title: "Facturación" };

type InvoiceRow = Invoice & { organizations: { name: string } | null };

export default async function FacturacionPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("invoices")
    .select("*, organizations(name)")
    .order("issued_at", { ascending: false });

  const invoices = (data ?? []) as InvoiceRow[];

  const activas = invoices.filter((i) => i.status !== "anulada");
  const totalFacturado = activas.reduce((s, i) => s + i.amount, 0);
  const totalCobrado = invoices
    .filter((i) => i.status === "pagada")
    .reduce((s, i) => s + i.amount, 0);
  const totalPendiente = invoices
    .filter((i) => i.status === "pendiente")
    .reduce((s, i) => s + i.amount, 0);
  const totalVencido = invoices
    .filter((i) => i.status === "vencida")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Facturación"
        description="Comprobantes emitidos a cada organización cliente."
        actions={<ButtonLink href="/admin/facturacion/nueva">Nueva factura</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Facturado"
          value={formatCurrency(totalFacturado)}
          icon={<Receipt className="size-4" />}
          hint="Histórico, sin anuladas"
        />
        <StatCard
          label="Cobrado"
          value={formatCurrency(totalCobrado)}
          tone="success"
          hint="Facturas pagadas"
        />
        <StatCard
          label="Pendiente de cobro"
          value={formatCurrency(totalPendiente)}
          tone="warning"
          hint="Dentro de término"
        />
        <StatCard
          label="Vencido"
          value={formatCurrency(totalVencido)}
          tone="warning"
          hint="Requiere reclamo"
        />
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-5" />}
          title="Todavía no hay facturas"
          description="Emití el primer comprobante para una organización cliente."
          action={<ButtonLink href="/admin/facturacion/nueva">Crear la primera</ButtonLink>}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <TableWrap>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Organización</Th>
                    <Th>Comprobante</Th>
                    <Th className="text-right">Monto</Th>
                    <Th>Emisión</Th>
                    <Th>Vencimiento</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                    >
                      <Td className="font-medium">{inv.organizations?.name ?? "—"}</Td>
                      <Td>
                        <p className="font-medium">{inv.number}</p>
                        <p className="max-w-[240px] truncate text-xs text-[var(--muted)]">
                          {inv.concept}
                        </p>
                      </Td>
                      <Td className="text-right font-medium tabular-nums">
                        {formatCurrency(inv.amount, inv.currency)}
                      </Td>
                      <Td className="text-[var(--muted)]">{formatDate(inv.issued_at)}</Td>
                      <Td className="text-[var(--muted)]">{formatDate(inv.due_at)}</Td>
                      <Td>
                        <form
                          action={updateInvoiceStatusAction}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="id" value={inv.id} />
                          <InvoiceStatusBadge status={inv.status} />
                          <select
                            name="status"
                            defaultValue={inv.status}
                            aria-label={`Cambiar estado de ${inv.number}`}
                            className="h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--muted)]"
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="pagada">Pagada</option>
                            <option value="vencida">Vencida</option>
                            <option value="anulada">Anulada</option>
                          </select>
                          <button
                            type="submit"
                            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--primary)] hover:underline"
                          >
                            Aplicar
                          </button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
