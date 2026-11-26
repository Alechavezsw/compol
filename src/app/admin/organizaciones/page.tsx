import Link from "next/link";
import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import { BarChart3, Building2, ClipboardList, IdCard, UserPlus } from "lucide-react";
import { PageHeader, EmptyState, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { OrgStatusBadge } from "@/components/ui/badge";
import { OrgMark } from "@/components/org-mark";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";
import { ORG_TYPE_LABEL, type Organization, type Survey } from "@/lib/types";
import { updateOrganizationStatusAction } from "../actions";
import { DeleteOrganizationButton } from "./delete-organization-button";

export const metadata: Metadata = { title: "Organizaciones" };

export default async function OrganizacionesPage() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  const orgs = (data ?? []) as Organization[];

  const [{ data: surveyRows }, { data: profileRows }] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, organization_id, title, status, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("profiles").select("organization_id"),
  ]);

  const surveysByOrg = new Map<string, number>();
  const latestSurveyByOrg = new Map<string, Pick<Survey, "id" | "title">>();
  for (const s of surveyRows ?? []) {
    if (!s.organization_id) continue;
    surveysByOrg.set(s.organization_id, (surveysByOrg.get(s.organization_id) ?? 0) + 1);
    if (!latestSurveyByOrg.has(s.organization_id)) {
      latestSurveyByOrg.set(s.organization_id, { id: s.id, title: s.title });
    }
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
        actions={
          <>
            <ButtonLink href="/admin/organizaciones/nueva" variant="outline">
              Nueva organización
            </ButtonLink>
            <Link
              href="/admin/usuarios/nuevo?rol=politico"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[color-mix(in_oklab,#b45309_35%,var(--border))] bg-[color-mix(in_oklab,#fef3c7_55%,var(--surface))] px-4 text-sm font-medium text-[#8a4b12] shadow-[0_1px_0_rgba(255,255,255,.5)_inset] transition-all hover:-translate-y-0.5 hover:bg-[color-mix(in_oklab,#fef3c7_75%,var(--surface))]"
            >
              <IdCard className="size-4" />
              Alta Político
            </Link>
          </>
        }
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
                    <Th className="text-right">Acceso</Th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((o) => {
                    const latest = latestSurveyByOrg.get(o.id);
                    const politicoHref = `/admin/usuarios/nuevo?org=${o.id}&rol=politico&volver=${encodeURIComponent(`/admin/organizaciones/${o.id}`)}`;
                    return (
                      <tr
                        key={o.id}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                      >
                        <Td>
                          <Link href={`/admin/organizaciones/${o.id}`} className="flex items-center gap-3 group">
                            <OrgMark
                              type={o.type}
                              brandColor={o.brand_color}
                              name={o.name}
                              id={o.id}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[var(--foreground)] group-hover:text-[var(--primary)] group-hover:underline">
                                {o.name}
                              </p>
                              <p className="truncate text-xs text-[var(--muted)]">
                                {o.region ? `${o.region} · ` : ""}
                                {o.contact_email ?? "sin contacto"}
                              </p>
                            </div>
                          </Link>
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
                        <Td>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Link
                              href={`/admin/organizaciones/${o.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                            >
                              Perfil
                            </Link>
                            <Link
                              href={politicoHref}
                              className="inline-flex items-center gap-1 rounded-lg border border-[color-mix(in_oklab,#b45309_30%,var(--border))] bg-[color-mix(in_oklab,#fef3c7_50%,transparent)] px-2 py-1.5 text-[11px] font-medium text-[#8a4b12] hover:bg-[color-mix(in_oklab,#fef3c7_80%,transparent)]"
                              title="Alta de Político (lectura / marca personal)"
                            >
                              <IdCard className="size-3" />
                              Político
                            </Link>
                            <Link
                              href={`/admin/usuarios/nuevo?org=${o.id}&rol=org_admin&volver=${encodeURIComponent(`/admin/organizaciones/${o.id}`)}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                            >
                              <UserPlus className="size-3" />
                              Admin
                            </Link>
                            {latest ? (
                              <>
                                <Link
                                  href={`/cliente/encuestas/${latest.id}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                                  title={latest.title}
                                >
                                  <ClipboardList className="size-3" />
                                  Encuesta
                                </Link>
                                <Link
                                  href={`/cliente/encuestas/${latest.id}/resultados`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary-soft)] px-2 py-1.5 text-[11px] font-medium text-[var(--primary)] hover:bg-[color-mix(in_oklab,var(--primary-soft)_80%,var(--primary))]"
                                  title={`Resultados · ${latest.title}`}
                                >
                                  <BarChart3 className="size-3" />
                                  Resultados
                                </Link>
                              </>
                            ) : (
                              <Link
                                href={`/admin/organizaciones/${o.id}#encuestas`}
                                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[var(--border)] px-2 py-1.5 text-[11px] font-medium text-[var(--muted)]"
                              >
                                Sin encuestas
                              </Link>
                            )}
                            <DeleteOrganizationButton id={o.id} name={o.name} size="sm" />
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
