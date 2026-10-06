import { cache, Suspense } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Globe,
  MapPin,
  Radar,
  Sparkles,
  Target,
  Timer,
  UserRound,
} from "lucide-react";
import { EmptyState, Progress } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, SurveyStatusBadge } from "@/components/ui/badge";
import { FieldTrend } from "@/components/charts/charts";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard";
import { moodLabel } from "@/lib/social/analytics";
import { formatDayKey, todayKey } from "@/lib/stats";
import { cn, formatDate, formatNumber, formatPercent } from "@/lib/utils";

type Attention = { tone: "danger" | "warning" | "primary"; icon: React.ReactNode; title: string; detail: string; href: string };

const dashboard = cache(async function dashboard() {
  const { organization } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();
  return loadDashboard(supabase, organization.id, todayKey());
});

export default async function ClienteDashboard() {
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const firstName = profile.full_name.split(" ")[0] || "equipo";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-[#0b1020] px-6 py-7 text-slate-100 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.55)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-16 -top-20 size-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 size-56 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">Hola, {firstName}</p>
            <h1 className="display mt-2 text-[34px] leading-none text-white sm:text-[42px]">{organization.name}</h1>
            <p className="mt-3 max-w-xl text-sm text-slate-400">
              Estado de tus relevamientos, el humor en redes y lo que necesita atención hoy.
            </p>
            <Suspense fallback={<div className="mt-5 h-8 w-72 animate-pulse rounded-full bg-white/10" />}>
              <HeroChips />
            </Suspense>
          </div>
          {profile.role === "org_admin" ? (
            <ButtonLink href="/cliente/encuestas/nueva" className="h-12 bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              Nueva encuesta
            </ButtonLink>
          ) : null}
        </div>
      </section>

      <Suspense fallback={<DashboardFallback />}>
        <DashboardBody role={profile.role} />
      </Suspense>
    </div>
  );
}

async function HeroChips() {
  const { active, days, social } = await dashboard();
  const todayCount = days.at(-1)?.value ?? 0;
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-slate-200">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
        {formatNumber(todayCount)} casos hoy
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-slate-200">
        {formatNumber(active.length)} en campo
      </span>
      <Link
        href="/cliente/redes"
        className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[12px] text-cyan-100 hover:bg-cyan-400/15"
      >
        Radar {social.total ? `${social.mood > 0 ? "+" : ""}${Math.round(social.mood)}` : "en espera"}
      </Link>
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-48 animate-pulse rounded-[22px] bg-[var(--surface-2)]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-[22px] bg-[var(--surface-2)]" />
        ))}
      </div>
    </div>
  );
}

async function DashboardBody({ role }: { role: string }) {
  const {
    surveys,
    active,
    completedCount,
    countBySurvey,
    days,
    paceBySurvey,
    expressBySurvey,
    staleBySurvey,
    reports,
    social,
    control,
  } = await dashboard();

  const totalTarget = active.reduce((sum, s) => sum + s.target_responses, 0);
  const activeDone = active.reduce((sum, s) => sum + (countBySurvey.get(s.id) ?? 0), 0);
  const todayCount = days.at(-1)?.value ?? 0;
  const last14 = days.reduce((s, d) => s + d.value, 0);
  const socialLabel = social.total ? moodLabel(social.mood) : null;

  const attention: Attention[] = [];
  for (const s of active) {
    const href = `/cliente/encuestas/${s.id}/resultados`;
    const pace = paceBySurvey.get(s.id);
    if (pace?.status === "atrasada" && pace.requiredPerDay) {
      attention.push({
        tone: "danger",
        icon: <CalendarClock className="size-4" />,
        title: `«${s.title}» viene atrasada`,
        detail: `Hacen falta ${Math.ceil(pace.requiredPerDay)} casos por día; el ritmo actual es ${pace.perDayLast7.toFixed(1).replace(".", ",")}.`,
        href,
      });
    } else if (pace?.status === "sin_ritmo") {
      attention.push({
        tone: "warning",
        icon: <CalendarClock className="size-4" />,
        title: `«${s.title}» sin cargas en 7 días`,
        detail: "El operativo está en campo pero no entra ningún caso.",
        href,
      });
    }
    const express = expressBySurvey.get(s.id) ?? 0;
    if (express) {
      attention.push({
        tone: "warning",
        icon: <Timer className="size-4" />,
        title: `${express} entrevistas exprés en «${s.title}»`,
        detail: "Duraron menos del 40% de la mediana. Conviene auditarlas antes del cierre.",
        href: `${href}#equipo`,
      });
    }
    const stale = staleBySurvey.get(s.id) ?? [];
    if (stale.length) {
      attention.push({
        tone: "primary",
        icon: <AlertTriangle className="size-4" />,
        title: `${stale.map((x) => x.name).join(", ")} sin cargar hace ${Math.min(...stale.map((x) => x.daysSinceLast ?? 0))}+ días`,
        detail: "El equipo de campo lo gestiona la administración central: avisale para reasignar o reforzar.",
        href: `${href}#equipo`,
      });
    }
  }
  if (control.quality.bursts.length) {
    const burst = control.quality.bursts[0];
    attention.push({
      tone: "warning",
      icon: <Timer className="size-4" />,
      title: `Racha rara en ${burst.zone}`,
      detail: `${burst.count} casos en menos de media hora. Conviene revisar si fueron reales.`,
      href: "/cliente/encuestas",
    });
  }
  if (control.quality.offQuota) {
    attention.push({
      tone: "primary",
      icon: <MapPin className="size-4" />,
      title: `${control.quality.offQuota} casos fuera de cuota`,
      detail: "Se cargaron en un departamento que no estaba en la asignación.",
      href: "/cliente/encuestas",
    });
  }
  for (const al of social.alerts.slice(0, 2)) {
    attention.push({
      tone: "danger",
      icon: <Radar className="size-4" />,
      title: al.title,
      detail: al.detail,
      href: `/cliente/redes${al.topic ? `?tema=${encodeURIComponent(al.topic)}` : ""}`,
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--primary)] uppercase">Hoy en campo</p>
            <h2 className="display mt-1 text-2xl text-[var(--foreground)]">{formatNumber(control.today)} casos</h2>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {control.quality.express
              ? `${control.quality.express} exprés · `
              : ""}
            {control.surveyors.filter((s) => s.stalled).length
              ? `${control.surveyors.filter((s) => s.stalled).length} sin cargar hoy`
              : "El equipo está cargando"}
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Equipo</p>
            <ul className="space-y-2">
              {control.surveyors.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">Nadie asignado a un operativo activo.</li>
              ) : (
                control.surveyors.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2">
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-[var(--foreground)]">
                      <UserRound className="size-3.5 shrink-0 text-[var(--muted)]" />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className={cn("text-xs font-medium tabular-nums", s.stalled ? "text-[var(--warning)]" : "text-[var(--success)]")}>
                      {s.stalled ? "Sin carga" : `${s.today} hoy`}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Departamentos</p>
            <ul className="space-y-2">
              {control.zones.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">Todavía no hay cuotas por departamento.</li>
              ) : (
                control.zones.map((z) => (
                  <li key={z.zone}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
                        <MapPin className="size-3.5" />
                        {z.zone}
                      </span>
                      <span className="tabular-nums text-[var(--foreground)]">
                        {z.done}/{z.quota} · hoy {z.today}
                      </span>
                    </div>
                    <Progress value={z.done} max={z.quota} className="mt-1.5" tone={z.done >= z.quota ? "success" : "primary"} />
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

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
          value={formatNumber(completedCount)}
          icon={<ClipboardList className="size-4" />}
          hint={`${formatNumber(todayCount)} hoy · ${formatNumber(last14)} en 14 días`}
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
            label="Radar de conversación (7 días)"
            value={social.total ? `${social.mood > 0 ? "+" : ""}${Math.round(social.mood)}` : "—"}
            icon={<Radar className="size-4" />}
            tone={socialLabel?.tone === "success" ? "success" : "warning"}
            hint={social.total && socialLabel ? `${socialLabel.text} · ${formatNumber(social.total)} publicaciones` : "Sin publicaciones importadas"}
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
                action={role === "org_admin" ? <ButtonLink href="/cliente/encuestas/nueva">Crear encuesta</ButtonLink> : null}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {surveys.slice(0, 6).map((s) => {
                  const done = countBySurvey.get(s.id) ?? 0;
                  const pace = paceBySurvey.get(s.id);
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
                        <Progress value={done} max={s.target_responses} className="flex-1" tone={pace?.status === "atrasada" ? "accent" : "primary"} />
                        <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                          {formatNumber(done)}/{formatNumber(s.target_responses)}
                        </span>
                      </div>
                      {pace?.eta && pace.status !== "cumplida" ? (
                        <p className={cn("mt-2 text-[11px] font-medium", pace.status === "atrasada" ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                          {pace.status === "atrasada" ? "Atrasada" : "En ritmo"} · meta estimada el {formatDayKey(pace.eta)}
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
              Ver biblioteca
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {reports.length === 0 ? (
              <div className="py-6 text-center">
                <Sparkles className="mx-auto size-5 text-[var(--muted)]" />
                <p className="mt-2 text-sm text-[var(--muted)]">Todavía no generaste informes con IA.</p>
                <ButtonLink href="/cliente/informes" size="sm" variant="secondary" className="mt-3">
                  Generar el primero
                </ButtonLink>
              </div>
            ) : (
              reports.map((r) => (
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
