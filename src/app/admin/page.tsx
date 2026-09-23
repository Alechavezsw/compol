import Link from "next/link";
import { Building2, ClipboardList, MessagesSquare, Users } from "lucide-react";
import { PageHeader, Td, TableWrap, Th } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { OrgStatusBadge, SurveyStatusBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";
import { ORG_TYPE_LABEL, type Organization, type Survey } from "@/lib/types";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [orgs, profiles, surveys, responses, recentOrgs, recentSurveys] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("surveys").select("id", { count: "exact", head: true }),
    supabase
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("status", "completada"),
    supabase.from("organizations").select("*").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("surveys")
      .select("*, organizations(name)")
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  const orgList = (recentOrgs.data ?? []) as Organization[];
  const surveyList = (recentSurveys.data ?? []) as (Survey & {
    organizations: { name: string } | null;
  })[];

  return (
    <div className="space-y-7">
      <PageHeader
        title="Panel general"
        description="Estado de la plataforma: clientes activos, operativos en curso y volumen de campo."
        actions={
          <>
            <ButtonLink href="/admin/organizaciones/nueva" variant="outline">
              Nueva organización
            </ButtonLink>
            <ButtonLink href="/admin/usuarios/nuevo">Nuevo usuario</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Organizaciones"
          value={formatNumber(orgs.count ?? 0)}
          icon={<Building2 className="size-4" />}
          hint="Clientes dados de alta"
        />
        <StatCard
          label="Usuarios"
          value={formatNumber(profiles.count ?? 0)}
          icon={<Users className="size-4" />}
          tone="accent"
          hint="Todos los roles"
        />
        <StatCard
          label="Encuestas"
          value={formatNumber(surveys.count ?? 0)}
          icon={<ClipboardList className="size-4" />}
          tone="warning"
          hint="Históricas y en curso"
        />
        <StatCard
          label="Casos completados"
          value={formatNumber(responses.count ?? 0)}
          icon={<MessagesSquare className="size-4" />}
          tone="success"
          hint="Entrevistas cerradas"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Últimos operativos</CardTitle>
            <Link
              href="/admin/encuestas"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {surveyList.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">
                Todavía no hay encuestas cargadas.
              </p>
            ) : (
              <TableWrap>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <Th>Encuesta</Th>
                      <Th>Organización</Th>
                      <Th>Estado</Th>
                      <Th className="text-right">Meta</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveyList.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                      >
                        <Td className="font-medium">{s.title}</Td>
                        <Td className="text-[var(--muted)]">{s.organizations?.name ?? "—"}</Td>
                        <Td>
                          <SurveyStatusBadge status={s.status} />
                        </Td>
                        <Td className="text-right tabular-nums">
                          {formatNumber(s.target_responses)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Altas recientes</CardTitle>
            <Link
              href="/admin/organizaciones"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {orgList.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">
                Todavía no hay organizaciones.
              </p>
            ) : (
              orgList.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">{o.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {ORG_TYPE_LABEL[o.type]} · alta {formatDate(o.created_at)}
                    </p>
                  </div>
                  <OrgStatusBadge status={o.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
