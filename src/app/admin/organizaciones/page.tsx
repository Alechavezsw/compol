import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PageHeader, EmptyState, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { OrgStatusBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";
import { ORG_TYPE_LABEL, type Organization } from "@/lib/types";
import { updateOrganizationStatusAction } from "../actions";

export const metadata: Metadata = { title: "Organizaciones" };

export default async function OrganizacionesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  const orgs = (data ?? []) as Organization[];

  const [{ data: surveyRows }, { data: profileRows }] = await Promise.all([
    supabase.from("surveys").select("organization_id"),
    supabase.from("profiles").select("organization_id"),
  ]);

  const surveysByOrg = new Map<string, number>();
  for (const s of surveyRows ?? []) {
    if (!s.organization_id) continue;
    surveysByOrg.set(s.organization_id, (surveysByOrg.get(s.organization_id) ?? 0) + 1);
  }
  const usersByOrg = new Map<string, number>();
  for (const p of profileRows ?? []) {
    if (!p.organization_id) continue;
    usersByOrg.set(p.organization_id, (usersByOrg.get(p.organization_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Organizaciones"
        description="Los clientes de la plataforma: municipios, ministerios, universidades y cámaras."
        actions={<ButtonLink href="/admin/organizaciones/nueva">Nueva organización</ButtonLink>}
      />

      {orgs.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="Todavía no hay organizaciones"
          description="Creá el primer cliente para poder cargarle usuarios y encuestas."
          action={<ButtonLink href="/admin/organizaciones/nueva">Crear la primera</ButtonLink>}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <TableWrap>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Organización</Th>
                    <Th>Tipo</Th>
                    <Th className="text-right">Usuarios</Th>
                    <Th className="text-right">Encuestas</Th>
                    <Th>Alta</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                    >
                      <Td>
                        <div className="flex items-center gap-3">
                          <span
                            className="size-8 shrink-0 rounded-lg"
                            style={{ background: o.brand_color ?? "var(--primary)" }}
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{o.name}</p>
                            <p className="truncate text-xs text-[var(--muted)]">
                              {o.region ? `${o.region} · ` : ""}
                              {o.contact_email ?? "sin contacto"}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td className="text-[var(--muted)]">{ORG_TYPE_LABEL[o.type]}</Td>
                      <Td className="text-right tabular-nums">
                        {formatNumber(usersByOrg.get(o.id) ?? 0)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {formatNumber(surveysByOrg.get(o.id) ?? 0)}
                      </Td>
                      <Td className="text-[var(--muted)]">{formatDate(o.created_at)}</Td>
                      <Td>
                        <form action={updateOrganizationStatusAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={o.id} />
                          <OrgStatusBadge status={o.status} />
                          <select
                            name="status"
                            defaultValue={o.status}
                            aria-label={`Cambiar estado de ${o.name}`}
                            className="h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--muted)]"
                          >
                            <option value="activa">Activa</option>
                            <option value="prueba">En prueba</option>
                            <option value="suspendida">Suspendida</option>
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
