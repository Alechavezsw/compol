import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { EmptyState, PageHeader, Progress, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { SurveyStatusBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Survey } from "@/lib/types";

export const metadata: Metadata = { title: "Encuestas" };

type Row = Survey & { organizations: { name: string } | null };

export default async function AdminEncuestasPage() {
  const supabase = await createClient();

  const [{ data }, { data: responseRows }] = await Promise.all([
    supabase
      .from("surveys")
      .select("*, organizations(name)")
      .order("updated_at", { ascending: false }),
    fetchAll<{ survey_id: string; surveyor_id: string | null; submitted_at: string | null }>((from, to) =>supabase.from("responses").select("survey_id").eq("status", "completada").order("id").range(from, to),
    ).then((data) => ({ data })),
  ]);

  const surveys = (data ?? []) as Row[];

  const counts = new Map<string, number>();
  for (const r of responseRows ?? []) {
    counts.set(r.survey_id, (counts.get(r.survey_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Encuestas"
        description="Todos los operativos de la plataforma, ordenados por última actividad."
      />

      {surveys.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="No hay encuestas cargadas"
          description="Las encuestas las crea cada organización desde su propio panel."
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <TableWrap>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Encuesta</Th>
                    <Th>Organización</Th>
                    <Th>Estado</Th>
                    <Th className="w-52">Avance</Th>
                    <Th>Cierre</Th>
                  </tr>
                </thead>
                <tbody>
                  {surveys.map((s) => {
                    const done = counts.get(s.id) ?? 0;
                    const pct = s.target_responses ? (done / s.target_responses) * 100 : 0;
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                      >
                        <Td>
                          <p className="font-medium">{s.title}</p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {s.geography ?? "Sin ámbito definido"}
                          </p>
                        </Td>
                        <Td className="text-[var(--muted)]">{s.organizations?.name ?? "—"}</Td>
                        <Td>
                          <SurveyStatusBadge status={s.status} />
                        </Td>
                        <Td>
                          <div className="flex items-center gap-3">
                            <Progress value={done} max={s.target_responses} className="flex-1" />
                            <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                              {formatNumber(done)}/{formatNumber(s.target_responses)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--muted)]">{pct.toFixed(0)}%</p>
                        </Td>
                        <Td className="text-[var(--muted)]">{formatDate(s.ends_at)}</Td>
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
