import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdCard } from "lucide-react";
import { EmptyState, PageHeader, Progress, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { formatDate, formatPercent } from "@/lib/utils";
import type { Dirigente, DirigenteMedicion } from "@/lib/types";
import { MedicionForm } from "./medicion-form";

export const metadata: Metadata = { title: "Ficha de dirigente" };

export default async function DirigentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const { data: dirigenteData } = await supabase
    .from("dirigentes")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  const dirigente = dirigenteData as Dirigente | null;
  if (!dirigente) notFound();

  const [{ data: medicionesData }, { data: projectsData }] = await Promise.all([
    supabase
      .from("dirigente_mediciones")
      .select("*")
      .eq("dirigente_id", id)
      .order("measured_at", { ascending: false }),
    supabase.from("projects").select("id, name").eq("organization_id", organization.id),
  ]);
  const mediciones = (medicionesData ?? []) as DirigenteMedicion[];
  const projectName = new Map((projectsData ?? []).map((p) => [p.id, p.name]));

  const canManage = profile.role === "org_admin";
  const latest = mediciones[0];

  return (
    <div className="space-y-7">
      <PageHeader
        title={dirigente.name}
        description={[dirigente.role, dirigente.affiliation].filter(Boolean).join(" · ") || undefined}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] font-medium text-[var(--muted)]">Conocimiento</p>
            <p className="display mt-2 text-[32px] leading-none text-[var(--foreground)]">
              {formatPercent(latest?.conocimiento)}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">Última medición</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] font-medium text-[var(--muted)]">Imagen positiva</p>
            <p className="display mt-2 text-[32px] leading-none text-[var(--success)]">
              {formatPercent(latest?.imagen_positiva)}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">Última medición</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] font-medium text-[var(--muted)]">Imagen negativa</p>
            <p className="display mt-2 text-[32px] leading-none text-[var(--danger)]">
              {formatPercent(latest?.imagen_negativa)}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">Última medición</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Evolución</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {mediciones.length === 0 ? (
              <EmptyState
                icon={<IdCard className="size-5" />}
                title="Sin mediciones"
                description="Cargá la primera medición para empezar a ver la evolución."
              />
            ) : (
              <TableWrap>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <Th>Fecha</Th>
                      <Th>Proyecto</Th>
                      <Th className="w-28">Conocimiento</Th>
                      <Th className="w-28">Imagen +</Th>
                      <Th className="w-28">Imagen −</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediciones.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                      >
                        <Td className="text-[var(--muted)]">{formatDate(m.measured_at)}</Td>
                        <Td className="text-[var(--muted)]">
                          {m.project_id ? (projectName.get(m.project_id) ?? "—") : "—"}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Progress value={m.conocimiento ?? 0} className="flex-1" />
                            <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                              {formatPercent(m.conocimiento)}
                            </span>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Progress value={m.imagen_positiva ?? 0} tone="success" className="flex-1" />
                            <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                              {formatPercent(m.imagen_positiva)}
                            </span>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Progress value={m.imagen_negativa ?? 0} className="flex-1" />
                            <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                              {formatPercent(m.imagen_negativa)}
                            </span>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ficha</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3 pt-4">
              <Avatar name={dirigente.name} src={dirigente.photo_url} size={44} />
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{dirigente.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {dirigente.role ?? "Sin cargo"}
                  {dirigente.affiliation ? ` · ${dirigente.affiliation}` : ""}
                </p>
                {dirigente.notes ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">{dirigente.notes}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Nueva medición</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <MedicionForm
                  dirigenteId={dirigente.id}
                  projects={(projectsData ?? []).map((p) => ({ id: p.id, name: p.name }))}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
