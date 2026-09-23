import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Globe,
  Radar,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, SurveyStatusBadge } from "@/components/ui/badge";
import { FieldTrend } from "@/components/charts/charts";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { computeAnalytics, loadSurveyData, type SurveyAnalytics } from "@/lib/analytics";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { computeSocial, moodLabel } from "@/lib/social/analytics";
import { addDays, dayKey, formatDayKey, todayKey } from "@/lib/stats";
import { cn, formatDate, formatNumber, formatPercent } from "@/lib/utils";
import type { SocialPost, Survey } from "@/lib/types";

type Attention = { tone: "danger" | "warning" | "primary"; icon: React.ReactNode; title: string; detail: string; href: string };

export default async function ClienteDashboard() {
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();
  const today = todayKey();

  const [{ data: surveyRows }, completedRows, { data: reportRows }, socialPosts] = await Promise.all([
    supabase.from("surveys").select("*").eq("organization_id", organization.id).order("updated_at", { ascending: false }),
    fetchAll<{ survey_id: string; submitted_at: string | null }>((from, to) =>
      supabase
        .from("responses")
        .select("survey_id, submitted_at")
        .eq("organization_id", organization.id)
        .eq("status", "completada")
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("ai_reports")
      .select("id, title, created_at, survey_id, kind")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(4),
    fetchAll<SocialPost>((from, to) =>
      supabase
        .from("social_posts")
        .select("*")
        .eq("organization_id", organization.id)
        .gte("published_at", new Date(`${addDays(today, -14)}T00:00:00-03:00`).toISOString())
        .order("id")
        .range(from, to),
    ),
  ]);

  const surveys = (surveyRows ?? []) as Survey[];
  const active = surveys.filter((s) => s.status === "activa");

  const countBySurvey = new Map<string, number>();
  for (const r of completedRows) countBySurvey.set(r.survey_id, (countBySurvey.get(r.survey_id) ?? 0) + 1);

  // Analítica completa solo de lo que está en campo: es lo que puede requerir acción hoy.
  const activeAnalytics = (
    await Promise.all(active.map(async (s) => {
      const data = await loadSurveyData(supabase, s.id);
      return data ? computeAnalytics(data) : null;
    }))
  ).filter((a): a is SurveyAnalytics => Boolean(a));
  const paceBySurvey = new Map(activeAnalytics.map((a) => [a.survey.id, a]));

  const totalTarget = active.reduce((sum, s) => sum + s.target_responses, 0);
  const activeDone = active.reduce((sum, s) => sum + (countBySurvey.get(s.id) ?? 0), 0);
  const social = socialPosts.length ? computeSocial(socialPosts, { days: 7 }, today) : null;

  // --- Serie de 14 días en hora argentina -------------------------------------
  const byDay = new Map<string, number>();
  for (const r of completedRows) {
    if (!r.submitted_at) continue;
    const key = dayKey(r.submitted_at);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).reduce<
    { key: string; name: string; value: number; cumulative: number }[]
  >((acc, key) => {
    const value = byDay.get(key) ?? 0;
    return [...acc, { key, name: formatDayKey(key), value, cumulative: (acc.at(-1)?.cumulative ?? 0) + value }];
  }, []);

  // --- Qué requiere atención --------------------------------------------------
  const attention: Attention[] = [];
  for (const a of activeAnalytics) {
    const href = `/cliente/encuestas/${a.survey.id}/resultados`;
    if (a.pace.status === "atrasada" && a.pace.requiredPerDay) {
      attention.push({
        tone: "danger",
        icon: <CalendarClock className="size-4" />,
        title: `«${a.survey.title}» viene atrasada`,
        detail: `Hacen falta ${Math.ceil(a.pace.requiredPerDay)} casos por día; el ritmo actual es ${a.pace.perDayLast7.toFixed(1).replace(".", ",")}.`,
        href,
      });
    } else if (a.pace.status === "sin_ritmo") {
      attention.push({
        tone: "warning",
        icon: <CalendarClock className="size-4" />,
        title: `«${a.survey.title}» sin cargas en 7 días`,
        detail: "El operativo está en campo pero no entra ningún caso.",
        href,
      });
    }
    if (a.quality.expressCount) {
      attention.push({
        tone: "warning",
        icon: <Timer className="size-4" />,
        title: `${a.quality.expressCount} entrevistas exprés en «${a.survey.title}»`,
        detail: "Duraron menos del 40% de la mediana. Conviene auditarlas antes del cierre.",
        href: `${href}#equipo`,
      });
    }
    const stale = a.bySurveyor.filter((s) => s.daysSinceLast !== null && s.daysSinceLast >= 2);
    if (stale.length) {
      attention.push({
        tone: "primary",
        icon: <AlertTriangle className="size-4" />,
        title: `${stale.map((s) => s.name).join(", ")} sin cargar hace ${Math.min(...stale.map((s) => s.daysSinceLast ?? 0))}+ días`,
        detail: "El equipo de campo lo gestiona la administración central: avisale para reasignar o reforzar.",
        href: `${href}#equipo`,
      });
    }
  }
  for (const al of social?.alerts.filter((x) => x.kind !== "tema_emergente").slice(0, 2) ?? []) {
    attention.push({
      tone: "danger",
      icon: <Radar className="size-4" />,
      title: al.title,
      detail: al.detail,
      href: `/cliente/redes${al.topic ? `?tema=${encodeURIComponent(al.topic)}` : ""}`,
    });
  }

  const socialLabel = social ? moodLabel(social.mood) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="text-sm font-medium text-[var(--muted)]">Hola, {profile.full_name.split(" ")[0] || "equipo"}</span>}
        title={organization.name}
        description="Estado de tus relevamientos, el humor en redes y lo que necesita atención hoy."
        actions={profile.role === "org_admin" ? <ButtonLink href="/cliente/encuestas/nueva">Nueva encuesta</ButtonLink> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Encuestas en campo"
          value={formatNumber(active.length)}
          icon={<Activity className="size-4" />}
          tone="success"
          hint={`${surveys.length} en total · ${surveys.filter((s) => s.web_enabled).length} con canal web`}
        />
        <StatCard
          label="Casos completados"
          value={formatNumber(completedRows.length)}
          icon={<ClipboardList className="size-4" />}
          hint={`${formatNumber(days.at(-1)?.value ?? 0)} hoy · ${formatNumber(days.reduce((s, d) => s + d.value, 0))} en 14 días`}
        />
        <StatCard
          label="Avance de lo que está en campo"
          value={formatPercent(totalTarget ? (activeDone / totalTarget) * 100 : 0)}
          icon={<Target className="size-4" />}
          tone="accent"
          hint={`${formatNumber(activeDone)} de ${formatNumber(totalTarget)} casos`}
        />
        <Link href="/cliente/redes" className="block transition-transform hover:-translate-y-0.5">
          <StatCard
            label="Humor en redes (7 días)"
            value={social ? `${social.mood > 0 ? "+" : ""}${Math.round(social.mood)}` : "—"}
            icon={<Radar className="size-4" />}
            tone={socialLabel?.tone === "success" ? "success" : "warning"}
            hint={social && socialLabel ? `${socialLabel.text} · ${formatNumber(social.total)} publicaciones` : "Sin publicaciones importadas"}
            className="h-full"
          />
        </Link>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Ritmo de recolección</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">Casos cerrados por día en los últimos 14 días, campo y web</p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <FieldTrend data={days} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Requiere atención</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">Se calcula con los datos de hoy.</p>
            </div>
            {attention.length ? <Badge tone="danger">{attention.length}</Badge> : null}
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {attention.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--success-soft)] p-4 text-sm text-[var(--success)]">
                <CheckCircle2 className="size-5 shrink-0" />
                Todo en orden: operativos en ritmo y sin alertas en redes.
              </div>
            ) : (
              attention.slice(0, 6).map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-2xl border border-[var(--border)] p-3 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                      item.tone === "danger"
                        ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                        : item.tone === "warning"
                          ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                          : "bg-[var(--primary-soft)] text-[var(--primary)]",
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug text-[var(--foreground)]">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">{item.detail}</span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Encuestas</CardTitle>
            <Link href="/cliente/encuestas" className="text-sm font-medium text-[var(--primary)] hover:underline">
              Ver todas
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {surveys.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="size-5" />}
                title="Todavía no hay encuestas"
                description="Creá tu primer cuestionario y salí a campo o publicalo en la web."
                action={profile.role === "org_admin" ? <ButtonLink href="/cliente/encuestas/nueva">Crear encuesta</ButtonLink> : null}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {surveys.slice(0, 6).map((s) => {
                  const done = countBySurvey.get(s.id) ?? 0;
                  const a = paceBySurvey.get(s.id);
                  return (
                    <Link
                      key={s.id}
                      href={s.status === "borrador" ? `/cliente/encuestas/${s.id}` : `/cliente/encuestas/${s.id}/resultados`}
                      className="group rounded-2xl border border-[var(--border)] p-4 transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">{s.title}</p>
                        <SurveyStatusBadge status={s.status} />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                        {s.web_enabled ? <Globe className="size-3" /> : null}
                        {s.geography ?? "Sin ámbito"} · cierre {formatDate(s.ends_at)}
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <Progress value={done} max={s.target_responses} className="flex-1" tone={a?.pace.status === "atrasada" ? "accent" : "primary"} />
                        <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                          {formatNumber(done)}/{formatNumber(s.target_responses)}
                        </span>
                      </div>
                      {a?.pace.eta && a.pace.status !== "cumplida" ? (
                        <p className={cn("mt-2 text-[11px] font-medium", a.pace.status === "atrasada" ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                          {a.pace.status === "atrasada" ? "Atrasada" : "En ritmo"} · meta estimada el {formatDayKey(a.pace.eta)}
                        </p>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Últimos informes</CardTitle>
            <Link href="/cliente/informes" className="text-sm font-medium text-[var(--primary)] hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {(reportRows ?? []).length === 0 ? (
              <div className="py-6 text-center">
                <Sparkles className="mx-auto size-5 text-[var(--muted)]" />
                <p className="mt-2 text-sm text-[var(--muted)]">Todavía no generaste informes con IA.</p>
                <ButtonLink href="/cliente/informes" size="sm" variant="secondary" className="mt-3">
                  Generar el primero
                </ButtonLink>
              </div>
            ) : (
              (reportRows ?? []).map((r) => (
                <Link key={r.id} href={`/cliente/informes/${r.id}`} className="block rounded-xl border border-[var(--border)] p-3 transition-colors hover:bg-[var(--surface-2)]">
                  <p className="line-clamp-2 text-sm font-medium text-[var(--foreground)]">{r.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(r.created_at)}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
