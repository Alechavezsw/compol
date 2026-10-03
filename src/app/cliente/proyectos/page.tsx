import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ServiceLineBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Project } from "@/lib/types";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProyectosPage() {
  const { organization } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const [{ data }, { data: surveyRows }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
    supabase.from("surveys").select("project_id").eq("organization_id", organization.id),
  ]);

  const projects = (data ?? []) as Project[];

  const surveysByProject = new Map<string, number>();
  for (const s of surveyRows ?? []) {
    if (!s.project_id) continue;
    surveysByProject.set(s.project_id, (surveysByProject.get(s.project_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Proyectos"
        description="Agrupá tus encuestas por línea de servicio: tracking, monitor de gestión, estudios puntuales."
        actions={<ButtonLink href="/cliente/proyectos/nuevo">Nuevo proyecto</ButtonLink>}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-5" />}
          title="Todavía no hay proyectos"
          description="Creá un proyecto para agrupar las olas de una misma línea de servicio."
          action={<ButtonLink href="/cliente/proyectos/nuevo">Crear el primero</ButtonLink>}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <TableWrap>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Proyecto</Th>
                    <Th>Línea de servicio</Th>
                    <Th className="text-right">Encuestas</Th>
                    <Th>Alta</Th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                    >
                      <Td>
                        <div className="flex items-center gap-3">
                          <span
                            className="size-8 shrink-0 rounded-lg"
                            style={{ background: p.color ?? "var(--primary)" }}
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            {p.description ? (
                              <p className="truncate text-xs text-[var(--muted)]">
                                {p.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <ServiceLineBadge line={p.service_line} />
                      </Td>
                      <Td className="text-right tabular-nums">
                        {formatNumber(surveysByProject.get(p.id) ?? 0)}
                      </Td>
                      <Td className="text-[var(--muted)]">{formatDate(p.created_at)}</Td>
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
