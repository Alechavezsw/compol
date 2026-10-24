import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  ClipboardList,
  FolderKanban,
  Globe,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { Progress, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, OrgStatusBadge, RoleBadge, SurveyStatusBadge } from "@/components/ui/badge";
import { cn, formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/utils";
import {
  ORG_TYPE_LABEL,
  ROLE_LABEL,
  SERVICE_LINE_LABEL,
  type Organization,
  type Profile,
  type Project,
  type Survey,
  type SurveyStatus,
} from "@/lib/types";
import { OrgMark } from "@/components/org-mark";
import { OrgEditForm } from "./org-edit-form";
import { DeleteOrganizationButton } from "../delete-organization-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Organización" };
}

type ResponseRow = {
  id: string;
  survey_id: string;
  status: string;
  channel: string;
  surveyor_id: string | null;
  submitted_at: string | null;
  started_at: string;
  duration_seconds: number | null;
};

type Movement = {
  at: string;
  kind: "caso" | "informe" | "radar" | "usuario" | "encuesta" | "proyecto";
  title: string;
  detail: string;
};

export default async function OrganizacionPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super_admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: orgRow } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  if (!orgRow) notFound();
  const org = orgRow as Organization;

  const [profilesRes, projectsRes, surveysRes, reportsRes, importsRes, postsCount, reportsCount, responses] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("organization_id", id).order("created_at", { ascending: false }),
      supabase.from("projects").select("*").eq("organization_id", id).order("created_at", { ascending: false }),
      supabase.from("surveys").select("*").eq("organization_id", id).order("updated_at", { ascending: false }),
      supabase
        .from("ai_reports")
        .select("id, title, kind, status, created_at, survey_id")
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("social_imports")
        .select("id, mode, inserted, created_at")
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("organization_id", id),
      supabase.from("ai_reports").select("id", { count: "exact", head: true }).eq("organization_id", id),
      fetchAll<ResponseRow>((from, to) =>
        supabase
          .from("responses")
          .select("id, survey_id, status, channel, surveyor_id, submitted_at, started_at, duration_seconds")
          .eq("organization_id", id)
          .order("id")
          .range(from, to),
      ),
    ]);

  const users = (profilesRes.data ?? []) as Profile[];
  const projects = (projectsRes.data ?? []) as Project[];
  const surveys = (surveysRes.data ?? []) as Survey[];
  const reports = reportsRes.data ?? [];
  const imports = importsRes.data ?? [];

  const surveyById = new Map(surveys.map((s) => [s.id, s]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const completed = responses.filter((r) => r.status === "completada");
  const inProgress = responses.filter((r) => r.status === "en_curso");
  const discarded = responses.filter((r) => r.status === "descartada");
  const webDone = completed.filter((r) => r.channel === "web").length;
  const campoDone = completed.length - webDone;
  const targetTotal = surveys.reduce((s, x) => s + (x.target_responses || 0), 0);
  const activeUsers = users.filter((u) => u.is_active).length;

  const now = Date.now();
  const day = 86_400_000;
  const last7 = completed.filter((r) => r.submitted_at && now - new Date(r.submitted_at).getTime() <= 7 * day).length;
  const last30 = completed.filter((r) => r.submitted_at && now - new Date(r.submitted_at).getTime() <= 30 * day).length;

  const durations = completed.map((r) => r.duration_seconds).filter((n): n is number => typeof n === "number" && n > 0);
  const avgDuration =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  const byStatus = (status: SurveyStatus) => surveys.filter((s) => s.status === status).length;
  const fillRate = targetTotal > 0 ? (completed.length / targetTotal) * 100 : null;

  const casesBySurvey = new Map<string, number>();
  for (const r of completed) casesBySurvey.set(r.survey_id, (casesBySurvey.get(r.survey_id) ?? 0) + 1);

  const casesBySurveyor = new Map<string, number>();
  for (const r of completed) {
    if (!r.surveyor_id) continue;
    casesBySurveyor.set(r.surveyor_id, (casesBySurveyor.get(r.surveyor_id) ?? 0) + 1);
  }

  const movements: Movement[] = [];
  for (const r of completed.slice().sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "")).slice(0, 12)) {
    const survey = surveyById.get(r.survey_id);
    movements.push({
      at: r.submitted_at ?? r.started_at,
      kind: "caso",
      title: `Caso ${r.channel === "web" ? "web" : "de campo"}`,
      detail: survey?.title ?? "Encuesta",
    });
  }
  for (const report of reports.slice(0, 8)) {
    movements.push({
      at: report.created_at,
      kind: "informe",
      title: report.title || "Informe IA",
      detail: `${report.kind} · ${report.status}`,
    });
  }
  for (const row of imports.slice(0, 8)) {
    movements.push({
      at: row.created_at,
      kind: "radar",
      title: "Importación al radar",
      detail: `${row.mode ?? "import"} · ${formatNumber(row.inserted ?? 0)} notas`,
    });
  }
  for (const u of users.slice(0, 8)) {
    movements.push({
      at: u.created_at,
      kind: "usuario",
      title: `Alta de ${ROLE_LABEL[u.role]}`,
      detail: u.full_name || u.email || "Usuario",
    });
  }
  for (const s of surveys.slice(0, 6)) {
    movements.push({
      at: s.updated_at || s.created_at,
      kind: "encuesta",
      title: s.title,
      detail: `Estado: ${s.status}`,
    });
  }
  for (const p of projects.slice(0, 6)) {
    movements.push({
      at: p.created_at,
      kind: "proyecto",
      title: p.name,
      detail: SERVICE_LINE_LABEL[p.service_line] ?? p.service_line,
    });
  }
  movements.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const timeline = movements.slice(0, 18);

  const returnTo = `/admin/organizaciones/${id}`;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/organizaciones"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" />
          Organizaciones
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <span className="text-sm text-[var(--muted)]">{org.slug}</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <OrgMark type={org.type} brandColor={org.brand_color} name={org.name} id={org.id} size="lg" />
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <OrgStatusBadge status={org.status} />
              <Badge tone="neutral">{ORG_TYPE_LABEL[org.type]}</Badge>
            </div>
            <h1 className="display text-[32px] leading-[1.1] text-[var(--foreground)] sm:text-[38px]">{org.name}</h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {[org.region, org.country].filter(Boolean).join(" · ") || "Sin ámbito cargado"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ButtonLink href={`/admin/usuarios/nuevo?org=${id}&rol=org_admin&volver=${encodeURIComponent(returnTo)}`}>
            <UserPlus />
            Nuevo usuario
          </ButtonLink>
          <DeleteOrganizationButton id={org.id} name={org.name} />
        </div>
      </div>

      <div className="grid gap-3 rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-4 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4">
        <InfoChip icon={<Mail className="size-3.5" />} label="Correo" value={org.contact_email ?? "Sin correo"} />
        <InfoChip icon={<Phone className="size-3.5" />} label="Teléfono" value={org.contact_phone ?? "Sin teléfono"} />
        <InfoChip icon={<MapPin className="size-3.5" />} label="Ámbito" value={org.region ?? "Sin región"} />
        <InfoChip icon={<Activity className="size-3.5" />} label="Alta" value={formatDate(org.created_at)} />
      </div>

      {/* Estadísticas para la consultora */}
      <section className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--primary)] uppercase">
            Lectura para la consultora
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Estadísticas del cliente</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Números internos del operativo: no es el tablero del municipio, es lo que necesitamos para gestionar el
            acuerdo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Casos completados"
            value={formatNumber(completed.length)}
            icon={<ClipboardList className="size-4" />}
            tone="success"
            hint={targetTotal ? `${formatPercent(fillRate)} de la meta (${formatNumber(targetTotal)})` : "Sin meta cargada"}
          />
          <StatCard
            label="Últimos 7 días"
            value={formatNumber(last7)}
            icon={<Activity className="size-4" />}
            tone="accent"
            hint={`${formatNumber(last30)} en 30 días`}
          />
          <StatCard
            label="Equipo"
            value={`${formatNumber(activeUsers)}/${formatNumber(users.length)}`}
            icon={<Users className="size-4" />}
            hint={`${formatNumber(users.filter((u) => u.role === "surveyor").length)} encuestadores`}
          />
          <StatCard
            label="Radar e informes"
            value={formatNumber(reportsCount.count ?? 0)}
            icon={<Sparkles className="size-4" />}
            tone="warning"
            hint={`${formatNumber(postsCount.count ?? 0)} notas en el radar`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Mix de canal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <ChannelBar label="Campo" value={campoDone} total={completed.length} tone="primary" />
              <ChannelBar label="Web" value={webDone} total={completed.length} tone="accent" />
              <p className="text-xs text-[var(--muted)]">
                En curso: {formatNumber(inProgress.length)} · Descartadas: {formatNumber(discarded.length)}
                {avgDuration ? ` · Duración media ${Math.round(avgDuration / 60)} min` : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Encuestas por estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-4">
              {(
                [
                  ["activa", "Activas"],
                  ["borrador", "Borrador"],
                  ["pausada", "Pausadas"],
                  ["cerrada", "Cerradas"],
                ] as const
              ).map(([status, label]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">{label}</span>
                  <span className="font-medium tabular-nums">{formatNumber(byStatus(status))}</span>
                </div>
              ))}
              <p className="pt-1 text-xs text-[var(--muted)]">
                {formatNumber(projects.length)} proyectos · {formatNumber(surveys.filter((s) => s.web_enabled).length)} con
                canal web
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rendimiento de campo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-4">
              {users.filter((u) => u.role === "surveyor").length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Todavía no hay encuestadores en este cliente.</p>
              ) : (
                users
                  .filter((u) => u.role === "surveyor")
                  .sort((a, b) => (casesBySurveyor.get(b.id) ?? 0) - (casesBySurveyor.get(a.id) ?? 0))
                  .slice(0, 5)
                  .map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{u.full_name || u.email}</span>
                      <span className="shrink-0 tabular-nums text-[var(--muted)]">
                        {formatNumber(casesBySurveyor.get(u.id) ?? 0)}
                      </span>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          {/* Usuarios */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-4 text-[var(--primary)]" />
                  Usuarios · {formatNumber(users.length)}
                </CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Cuentas del organismo. Las altas las hace la administración central.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  size="sm"
                  variant="outline"
                  href={`/admin/usuarios/nuevo?org=${id}&rol=org_admin&volver=${encodeURIComponent(returnTo)}`}
                >
                  Admin
                </ButtonLink>
                <ButtonLink
                  size="sm"
                  variant="outline"
                  href={`/admin/usuarios/nuevo?org=${id}&rol=org_analyst&volver=${encodeURIComponent(returnTo)}`}
                >
                  Analista
                </ButtonLink>
                <ButtonLink
                  size="sm"
                  href={`/admin/usuarios/nuevo?org=${id}&rol=surveyor&volver=${encodeURIComponent(returnTo)}`}
                >
                  <UserPlus className="size-3.5" />
                  Encuestador
                </ButtonLink>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {users.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                  Todavía no hay usuarios. Creá el administrador del cliente para que pueda operar el panel.
                </p>
              ) : (
                <TableWrap>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <Th>Persona</Th>
                        <Th>Rol</Th>
                        <Th>Estado</Th>
                        <Th>Última vez</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                          <Td>
                            <p className="font-medium">{u.full_name || "Sin nombre"}</p>
                            <p className="text-xs text-[var(--muted)]">{u.email}</p>
                          </Td>
                          <Td>
                            <RoleBadge role={u.role} />
                          </Td>
                          <Td>
                            <Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Activo" : "Bloqueado"}</Badge>
                          </Td>
                          <Td className="text-[var(--muted)]">{formatDateTime(u.last_seen_at)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </CardContent>
          </Card>

          {/* Proyectos */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="size-4 text-[var(--primary)]" />
                  Proyectos · {formatNumber(projects.length)}
                </CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Líneas de servicio abiertas por el cliente.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-4">
              {projects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                  Sin proyectos todavía.
                </p>
              ) : (
                projects.map((p) => {
                  const count = surveys.filter((s) => s.project_id === p.id).length;
                  return (
                    <div key={p.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                      <span
                        className="mt-0.5 size-3 shrink-0 rounded-full"
                        style={{ background: p.color ?? "var(--primary)" }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {SERVICE_LINE_LABEL[p.service_line]} · {formatNumber(count)} encuestas · alta{" "}
                          {formatDate(p.created_at)}
                        </p>
                        {p.description ? <p className="mt-1 text-xs text-[var(--muted)]">{p.description}</p> : null}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Encuestas */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-4 text-[var(--primary)]" />
                  Encuestas · {formatNumber(surveys.length)}
                </CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Operativos del cliente con avance sobre la meta.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {surveys.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                  Sin encuestas todavía.
                </p>
              ) : (
                <div className="space-y-3">
                  {surveys.map((s) => {
                    const done = casesBySurvey.get(s.id) ?? 0;
                    const project = s.project_id ? projectById.get(s.project_id) : null;
                    return (
                      <article key={s.id} className="rounded-2xl border border-[var(--border)] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <SurveyStatusBadge status={s.status} endsAt={s.ends_at} />
                              {s.web_enabled ? (
                                <Badge tone="accent">
                                  <Globe className="size-3" />
                                  Web
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{s.title}</p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">
                              {project?.name ?? "Sin proyecto"}
                              {s.geography ? ` · ${s.geography}` : ""}
                              {s.ends_at ? ` · cierre ${formatDate(s.ends_at)}` : ""}
                            </p>
                          </div>
                          <p className="text-sm tabular-nums text-[var(--muted)]">
                            {formatNumber(done)}/{formatNumber(s.target_responses)}
                          </p>
                        </div>
                        <Progress
                          value={done}
                          max={Math.max(1, s.target_responses)}
                          className="mt-3"
                          tone={done >= s.target_responses ? "success" : "primary"}
                        />
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Datos del cliente</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Contacto, estado y notas internas de la consultora.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <OrgEditForm org={org} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-[var(--primary)]" />
                  Movimientos
                </CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Última actividad de este organismo en la plataforma.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {timeline.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                  Todavía no hay movimientos.
                </p>
              ) : (
                <ol className="space-y-3">
                  {timeline.map((m, i) => (
                    <li key={`${m.kind}-${m.at}-${i}`} className="flex gap-3">
                      <span
                        className={cn(
                          "mt-1 size-2.5 shrink-0 rounded-full",
                          m.kind === "caso" && "bg-[var(--success)]",
                          m.kind === "informe" && "bg-[var(--primary)]",
                          m.kind === "radar" && "bg-[var(--accent)]",
                          m.kind === "usuario" && "bg-[var(--warning)]",
                          m.kind === "encuesta" && "bg-[var(--chart-5)]",
                          m.kind === "proyecto" && "bg-[var(--muted)]",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">{m.title}</p>
                          <time className="shrink-0 text-[11px] text-[var(--muted)]">{formatDateTime(m.at)}</time>
                        </div>
                        <p className="truncate text-xs text-[var(--muted)]">{m.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function ChannelBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "primary" | "accent";
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="tabular-nums">
          {formatNumber(value)} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className={cn("h-full rounded-full", tone === "primary" ? "bg-[var(--primary)]" : "bg-[var(--accent)]")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
