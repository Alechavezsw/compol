import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { EmptyState, PageHeader, Progress, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Invoice, Organization } from "@/lib/types";

export const metadata: Metadata = { title: "Contabilidad" };

export default async function ContabilidadPage() {
  const supabase = await createClient();

  const [{ data: invoiceRows }, { data: orgRows }] = await Promise.all([
    supabase.from("invoices").select("*"),
    supabase.from("organizations").select("id, name"),
  ]);

  const invoices = (invoiceRows ?? []) as Invoice[];
  const organizations = (orgRows ?? []) as Pick<Organization, "id" | "name">[];

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

  const byOrg = organizations
    .map((org) => {
      const own = activas.filter((i) => i.organization_id === org.id);
      const facturado = own.reduce((s, i) => s + i.amount, 0);
      const cobrado = own
        .filter((i) => i.status === "pagada")
        .reduce((s, i) => s + i.amount, 0);
      const pendiente = own
        .filter((i) => i.status === "pendiente")
        .reduce((s, i) => s + i.amount, 0);
      const vencido = own
        .filter((i) => i.status === "vencida")
        .reduce((s, i) => s + i.amount, 0);
      return { org, facturado, cobrado, pendiente, vencido };
    })
    .filter((r) => r.facturado > 0)
    .sort((a, b) => b.facturado - a.facturado);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Contabilidad"
        description="Estado de cobranza de la plataforma, por organización."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Facturado"
          value={formatCurrency(totalFacturado)}
          icon={<Landmark className="size-4" />}
          hint="Histórico, sin anuladas"
        />
        <StatCard
          label="Cobrado"
          value={formatCurrency(totalCobrado)}
          tone="success"
          hint={`${formatPercent(totalFacturado > 0 ? (totalCobrado / totalFacturado) * 100 : 0)} del total`}
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

      {byOrg.length === 0 ? (
        <EmptyState
          icon={<Landmark className="size-5" />}
          title="Todavía no hay movimientos"
          description="Cuando emitas la primera factura desde Facturación, el estado de cobranza va a aparecer acá."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Cobranza por organización</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <TableWrap>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Organización</Th>
                    <Th className="text-right">Facturado</Th>
                    <Th className="text-right">Cobrado</Th>
                    <Th className="text-right">Pendiente</Th>
                    <Th className="text-right">Vencido</Th>
                    <Th>Cobranza</Th>
                  </tr>
                </thead>
                <tbody>
                  {byOrg.map(({ org, facturado, cobrado, pendiente, vencido }) => (
                    <tr
                      key={org.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                    >
                      <Td className="font-medium">{org.name}</Td>
                      <Td className="text-right tabular-nums">{formatCurrency(facturado)}</Td>
                      <Td className="text-right tabular-nums text-[var(--success)]">
                        {formatCurrency(cobrado)}
                      </Td>
                      <Td className="text-right tabular-nums text-[var(--warning)]">
                        {formatCurrency(pendiente)}
                      </Td>
                      <Td className="text-right tabular-nums text-[var(--danger)]">
                        {formatCurrency(vencido)}
                      </Td>
                      <Td className="w-40">
                        <Progress value={cobrado} max={facturado} tone="success" />
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
