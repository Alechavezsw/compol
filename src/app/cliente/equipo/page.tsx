import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Avatar, EmptyState, PageHeader, Progress, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { requireOrganization } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Equipo" };

export default async function EquipoPage() {
  const { organization } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const [{ data: teamRows }, { data: assignmentRows }, { data: responseRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", organization.id)
      .order("role")
      .order("full_name"),
    supabase.from("survey_assignments").select("surveyor_id, quota, zone, surveys(title, status)"),
    fetchAll<{ survey_id: string; surveyor_id: string | null; submitted_at: string | null }>((from, to) =>
      supabase.from("responses")
      .select("surveyor_id")
      .eq("organization_id", organization.id)
      .eq("status", "completada")
      .order("id").range(from, to),
    ).then((data) => ({ data })),
  ]);

  const team = (teamRows ?? []) as Profile[];

  const doneBySurveyor = new Map<string, number>();
  for (const r of responseRows ?? []) {
    if (!r.surveyor_id) continue;
    doneBySurveyor.set(r.surveyor_id, (doneBySurveyor.get(r.surveyor_id) ?? 0) + 1);
  }

  const quotaBySurveyor = new Map<string, number>();
  const activeAssignments = new Map<string, string[]>();
  for (const a of assignmentRows ?? []) {
    quotaBySurveyor.set(a.surveyor_id, (quotaBySurveyor.get(a.surveyor_id) ?? 0) + a.quota);
    if (a.surveys?.status === "activa") {
      const list = activeAssignments.get(a.surveyor_id) ?? [];
      list.push(a.surveys.title);
      activeAssignments.set(a.surveyor_id, list);
    }
  }

  const surveyors = team.filter((t) => t.role === "surveyor");
  const staff = team.filter((t) => t.role !== "surveyor");

  return (
    <div className="space-y-7">
      <PageHeader
        title="Equipo"
        description="Las personas de tu organización con acceso a la plataforma y el rendimiento del trabajo de campo."
      />

      {team.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Todavía no hay usuarios en tu organización"
          description="Las altas de usuarios las hace la administración central de la plataforma."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Encuestadores</CardTitle>
              <span className="text-sm text-[var(--muted)]">
                {formatNumber(surveyors.length)} personas en campo
              </span>
            </CardHeader>
            <CardContent className="pt-4">
              {surveyors.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--muted)]">
                  No hay encuestadores cargados para tu organización.
                </p>
              ) : (
                <TableWrap>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <Th>Encuestador</Th>
                        <Th>Operativos activos</Th>
                        <Th className="text-right">Casos</Th>
                        <Th className="w-52">Cumplimiento</Th>
                        <Th>Estado</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {surveyors.map((s) => {
                        const done = doneBySurveyor.get(s.id) ?? 0;
                        const quota = quotaBySurveyor.get(s.id) ?? 0;
                        const active = activeAssignments.get(s.id) ?? [];
                        return (
                          <tr
                            key={s.id}
                            className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                          >
                            <Td>
                              <div className="flex items-center gap-3">
                                <Avatar name={s.full_name} src={s.avatar_url} size={34} />
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{s.full_name}</p>
                                  <p className="truncate text-xs text-[var(--muted)]">{s.email}</p>
                                </div>
                              </div>
                            </Td>
                            <Td className="text-[var(--muted)]">
                              {active.length ? (
                                <span className="line-clamp-2 text-xs">{active.join(" · ")}</span>
                              ) : (
                                <span className="text-xs italic">Sin operativos activos</span>
                              )}
                            </Td>
                            <Td className="text-right tabular-nums">{formatNumber(done)}</Td>
                            <Td>
                              {quota ? (
                                <div className="flex items-center gap-3">
                                  <Progress
                                    value={done}
                                    max={quota}
                                    tone={done >= quota ? "success" : "primary"}
                                    className="flex-1"
                                  />
                                  <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                                    {formatNumber(done)}/{formatNumber(quota)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-[var(--muted)]">Sin cuota</span>
                              )}
                            </Td>
                            <Td>
                              <Badge tone={s.is_active ? "success" : "danger"}>
                                {s.is_active ? "Activo" : "Bloqueado"}
                              </Badge>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dirección y análisis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
              {staff.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3"
                >
                  <Avatar name={p.full_name} src={p.avatar_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {p.full_name}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {p.email} · alta {formatDate(p.created_at)}
                    </p>
                  </div>
                  <RoleBadge role={p.role} />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
