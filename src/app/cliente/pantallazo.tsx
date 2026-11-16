import Link from "next/link";
import { ArrowRight, Quote, Radar, Sparkles } from "lucide-react";
import { LiveRefresh } from "@/components/results/live-refresh";
import { DistributionBars } from "@/components/results/distribution-bars";
import { FieldTrend } from "@/components/charts/charts";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { loadDashboard } from "@/lib/dashboard";
import {
  computeAnalytics,
  keyFindings,
  loadSurveyData,
  type CrosstabFinding,
  type QuestionAnalytics,
} from "@/lib/analytics";
import { computeSocial, moodLabel } from "@/lib/social/analytics";
import { addDays, todayKey } from "@/lib/stats";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { AiReport, Organization, ReportHighlight, SocialPost } from "@/lib/types";

type Light = "ok" | "watch" | "alert" | "quiet";

const LIGHT_DOT: Record<Light, string> = {
  ok: "bg-emerald-300",
  watch: "bg-amber-300",
  alert: "bg-rose-400",
  quiet: "bg-slate-500",
};

const LIGHT_WORD: Record<Light, string> = {
  ok: "Firme",
  watch: "Atento",
  alert: "Se movió",
  quiet: "Sin lectura",
};

function recommendationsFrom(markdown: string | null) {
  if (!markdown) return [];
  const chunk = markdown.split(/\n##\s+Recomendaciones\s*\n/i)[1];
  if (!chunk) return [];
  return chunk
    .split(/\n##\s+/)[0]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .slice(0, 4);
}

function substantive(questions: QuestionAnalytics[]) {
  return questions.filter(
    (q) =>
      q.distribution.length > 0 &&
      (q.question.section ?? "").toLowerCase() !== "perfil" &&
      !q.question.logic?.end_if?.length,
  );
}

function leaderOf(q: QuestionAnalytics) {
  return [...q.distribution]
    .filter((d) => !d.exclusive && !/no sabe|ns\/nc/i.test(d.name))
    .sort((a, b) => b.percent - a.percent)[0];
}

function imageLight(q: QuestionAnalytics | undefined): Light {
  if (!q) return "quiet";
  if (q.net) {
    if (q.net.net >= 10) return "ok";
    if (q.net.net <= -10) return "alert";
    return "watch";
  }
  const leader = leaderOf(q);
  if (!leader) return "quiet";
  if (leader.valence === 1 && leader.percent >= 45) return "ok";
  if (leader.valence === -1 && leader.percent >= 40) return "alert";
  return "watch";
}

function talkLight(mood: number | null, total: number): Light {
  if (!total || mood === null) return "quiet";
  if (mood >= 10) return "ok";
  if (mood <= -10) return "alert";
  return "watch";
}

function zoneLight(finding: CrosstabFinding | undefined): Light {
  const gap = finding?.highlights[0];
  if (!gap) return "ok";
  const delta = Math.abs(gap.percent - gap.rest);
  if (delta < 8) return "ok";
  if (/mala|negativ|rechaz|peor|insegur|no\b/i.test(gap.row) && gap.percent > gap.rest) return "alert";
  return "watch";
}

function gapSentence(surveyNet: number | null, mood: number | null, hasSocial: boolean) {
  if (!hasSocial || surveyNet === null || mood === null) {
    return "Cuando haya escucha y una pregunta de imagen, este cruce dice si la calle se adelantó a la encuesta.";
  }
  if (surveyNet >= 8 && mood <= -10) return "La encuesta todavía sostiene la imagen. La conversación ya no.";
  if (surveyNet <= -8 && mood >= 10) return "En redes el clima es mejor de lo que está midiendo el campo.";
  if (Math.sign(surveyNet) !== Math.sign(mood) && Math.abs(surveyNet) >= 8 && Math.abs(mood) >= 8) {
    return "Encuesta y conversación no están diciendo lo mismo.";
  }
  return "Encuesta y conversación van en el mismo sentido.";
}

function pp(n: number) {
  const rounded = Math.round(n);
  return `${rounded > 0 ? "+" : ""}${rounded} pp`;
}

export async function PoliticoSnapshot({
  organization,
  firstName,
}: {
  organization: Organization;
  firstName: string;
}) {
  const supabase = await createClient();
  const today = todayKey();
  const dash = await loadDashboard(supabase, organization.id, today);

  const featured = [...dash.surveys].sort((a, b) => {
    const score = (status: string, id: string) =>
      (status === "activa" ? 1_000_000 : 0) + (dash.countBySurvey.get(id) ?? 0);
    return score(b.status, b.id) - score(a.status, a.id);
  })[0];

  let questions: QuestionAnalytics[] = [];
  let findings: CrosstabFinding[] = [];
  let completed = dash.completedCount;
  let margin: number | null = null;
  let target = featured?.target_responses ?? 0;
  let zones: { name: string; percent: number }[] = [];

  if (featured) {
    const data = await loadSurveyData(supabase, featured.id);
    if (data) {
      const analytics = computeAnalytics(data);
      completed = analytics.totals.completed;
      margin = analytics.totals.moe;
      target = analytics.totals.target;
      zones = analytics.byZone.slice(0, 8);
      questions = substantive(analytics.questions);
      findings = keyFindings(data, {}, 3);
    }
  }

  const posts = await fetchAll<SocialPost>((from, to) =>
    supabase
      .from("social_posts")
      .select("*")
      .eq("organization_id", organization.id)
      .gte("published_at", new Date(`${addDays(today, -30)}T00:00:00-03:00`).toISOString())
      .order("id")
      .range(from, to),
  );
  const social = computeSocial(posts, { days: 7 }, today);

  const { data: latest } = await supabase
    .from("ai_reports")
    .select("id, title, kind, content, highlights, created_at, status")
    .eq("organization_id", organization.id)
    .eq("status", "listo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const report = latest as Pick<AiReport, "id" | "title" | "kind" | "content" | "highlights"> | null;
  const recommendations = recommendationsFrom(report?.content ?? null);
  const highlight = ((report?.highlights ?? []) as ReportHighlight[])[0];
  const imageQuestion = questions.find((q) => q.net) ?? questions[0];
  const openQuestion = questions.find((q) => q.samples.length > 0);
  const quote = openQuestion?.samples.find((s) => s.trim().length >= 24 && s.trim().length <= 220)?.trim();
  const portrait = findings[0]?.highlights[0];
  const zoneFinding = findings.find((f) => f.by.kind === "zone")?.highlights[0];
  const leader = imageQuestion ? leaderOf(imageQuestion) : undefined;
  const mood = social.total ? moodLabel(social.mood) : null;
  const topTopic = social.topics[0];
  const imagen = imageLight(imageQuestion);
  const territorio = zones.length ? zoneLight(findings.find((f) => f.by.kind === "zone")) : "quiet";
  const conversacion = talkLight(social.total ? social.mood : null, social.total);
  const todayCount = dash.days.at(-1)?.value ?? 0;
  const live = dash.active.length;
  const fill = target > 0 ? Math.round((completed / target) * 100) : 0;

  const parte = highlight?.detalle
    ? highlight.detalle
    : portrait
      ? `En ${portrait.column}, «${portrait.row}» llega a ${formatPercent(portrait.percent)}. En el resto de la muestra está en ${formatPercent(portrait.rest)}.`
      : leader && imageQuestion
        ? `«${leader.name}» es lo que más pesa: ${formatPercent(leader.percent)} de quienes respondieron.`
        : "Todavía no hay casos suficientes para un parte. Cuando el campo cargue, esta frase se escribe sola.";

  const metric = highlight?.metrica
    ? highlight.metrica
    : portrait
      ? pp(portrait.percent - portrait.rest)
      : leader
        ? formatPercent(leader.percent)
        : "—";

  const advice =
    recommendations[0] ??
    (completed > 0
      ? "No hay una recomendación nueva. La lectura sigue siendo la de la última medición."
      : "La administración carga la encuesta y genera el informe. Acá aparece la lectura.");

  const lights: { label: string; tone: Light; detail: string }[] = [
    {
      label: "Imagen",
      tone: imagen,
      detail: imageQuestion?.net
        ? `Saldo ${imageQuestion.net.net > 0 ? "+" : ""}${Math.round(imageQuestion.net.net)}`
        : leader
          ? leader.name
          : "Sin pregunta de imagen",
    },
    {
      label: "Territorio",
      tone: territorio,
      detail: zoneFinding
        ? `${zoneFinding.column} se despega ${pp(zoneFinding.percent - zoneFinding.rest)}`
        : zones.length
          ? "Las zonas van parejas"
          : "Sin corte territorial",
    },
    {
      label: "Conversación",
      tone: conversacion,
      detail: mood ? `${mood.text} · ${social.mood > 0 ? "+" : ""}${Math.round(social.mood)}` : "Sin escucha esta semana",
    },
  ];

  return (
    <div className="space-y-6">
      {live > 0 ? <LiveRefresh /> : null}

      <section className="relative overflow-hidden rounded-[28px] bg-[#0b1020] px-6 py-7 text-slate-100 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.55)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-16 -top-20 size-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 size-56 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)] lg:items-end">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">
              El parte · {firstName}
            </p>
            <p className="display mt-4 max-w-3xl text-[28px] leading-[1.15] text-white sm:text-[36px]">{parte}</p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">{advice}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {lights.map((light) => (
                <span
                  key={light.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-slate-200"
                >
                  <span className={`size-1.5 rounded-full ${LIGHT_DOT[light.tone]}`} />
                  <span className="font-semibold">{light.label}</span>
                  <span className="text-slate-400">{LIGHT_WORD[light.tone]} · {light.detail}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-cyan-200/70 uppercase">El número</p>
            <p className="display mt-2 text-5xl text-white">{metric}</p>
            <p className="mt-2 text-sm text-slate-400">
              {formatNumber(completed)} casos
              {margin !== null ? ` · margen ±${margin.toFixed(1).replace(".", ",")} pp` : ""}
              {todayCount ? ` · ${formatNumber(todayCount)} hoy` : ""}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ButtonLink href="/cliente/encuestas" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                Ver en vivo
                <ArrowRight />
              </ButtonLink>
              {report ? (
                <ButtonLink href={`/cliente/informes/${report.id}`} variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10">
                  Informe
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Casos hoy" value={formatNumber(todayCount)} hint="Se actualiza mientras el campo carga" tone="success" />
        <StatCard
          label="Muestra"
          value={formatNumber(completed)}
          hint={target ? `${fill}% de la meta (${formatNumber(target)})` : "Sin meta cargada"}
        />
        <StatCard
          label="Imagen"
          value={imageQuestion?.net ? `${imageQuestion.net.net > 0 ? "+" : ""}${Math.round(imageQuestion.net.net)}` : "—"}
          hint={imageQuestion ? imageQuestion.question.text : "Sin pregunta de saldo"}
          tone={imagen === "alert" ? "warning" : "accent"}
        />
        <StatCard
          label="Conversación"
          value={mood ? `${social.mood > 0 ? "+" : ""}${Math.round(social.mood)}` : "—"}
          hint={mood ? `${mood.text} · 7 días` : "Sin notas esta semana"}
          icon={<Radar className="size-4" />}
          tone={conversacion === "alert" ? "warning" : "primary"}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--primary)] uppercase">El gráfico del parte</p>
              <CardTitle className="mt-1 text-[15px] leading-snug">
                {imageQuestion?.question.text ?? featured?.title ?? "Todavía no hay una pregunta para graficar"}
              </CardTitle>
            </div>
            {featured ? (
              <ButtonLink href={`/cliente/encuestas/${featured.id}/resultados`} size="sm" variant="outline">
                Tablero
              </ButtonLink>
            ) : null}
          </CardHeader>
          <CardContent className="pt-2">
            {imageQuestion ? (
              <DistributionBars data={imageQuestion.distribution.slice(0, 6)} multiple={imageQuestion.multiple} />
            ) : (
              <p className="py-8 text-sm text-[var(--muted)]">Cuando entren los primeros casos, el gráfico ocupa este lugar.</p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Quién se despega</CardTitle>
            <p className="text-xs text-[var(--muted)]">El corte donde la respuesta no es la del promedio.</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {portrait ? (
              <>
                <p className="text-sm leading-relaxed">
                  <span className="font-semibold">{portrait.column}</span> marca {formatPercent(portrait.percent)} en «
                  {portrait.row}». El resto de la muestra está en {formatPercent(portrait.rest)}.
                </p>
                <CompareBars
                  left={{ label: portrait.column, percent: portrait.percent }}
                  right={{ label: "Resto", percent: portrait.rest }}
                />
                <p className="text-xs text-[var(--muted)]">Base del corte: {formatNumber(portrait.base)} casos.</p>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Con más casos, acá aparece el grupo que no piensa como el promedio: la zona, la edad o el perfil que se corre.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lo que mide la encuesta</CardTitle>
            <p className="text-xs text-[var(--muted)]">{featured?.title ?? "Sin encuesta activa"}</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {imageQuestion ? (
              <>
                <p className="display text-4xl">
                  {imageQuestion.net
                    ? `${imageQuestion.net.net > 0 ? "+" : ""}${Math.round(imageQuestion.net.net)}`
                    : leader
                      ? formatPercent(leader.percent)
                      : "—"}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {imageQuestion.net ? "Saldo entre valoración alta y baja." : leader ? `«${leader.name}»` : "Sin distribución"}
                </p>
                <DistributionBars data={imageQuestion.distribution.slice(0, 4)} multiple={imageQuestion.multiple} showMoe={false} />
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">La encuesta todavía no tiene una distribución para poner al lado de la conversación.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Radar className="size-4 text-[var(--accent)]" />
              <CardTitle>Lo que dice la conversación</CardTitle>
            </div>
            <p className="text-xs text-[var(--muted)]">Últimos 7 días de redes y portales.</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {social.total ? (
              <>
                <p className="display text-4xl">
                  {social.mood > 0 ? "+" : ""}
                  {Math.round(social.mood)}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {mood?.text}. {formatNumber(social.total)} notas
                  {topTopic ? `. El tema que más pesa es «${topTopic.name}».` : "."}
                </p>
                <ul className="space-y-2.5">
                  {social.topics.slice(0, 4).map((topic) => (
                    <li key={topic.name}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{topic.name}</span>
                        <span className="tabular-nums font-semibold">{formatPercent(topic.share)}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-[var(--surface-2)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${Math.min(100, topic.share)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">Esta semana no hay conversación cargada para cruzar con la encuesta.</p>
            )}
            <p className="rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed">
              {gapSentence(imageQuestion?.net?.net ?? null, social.total ? social.mood : null, social.total > 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {quote ? (
        <section className="rounded-[28px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] px-6 py-7 shadow-[var(--shadow-card)] sm:px-8">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-[var(--primary)] uppercase">
            <Quote className="size-3.5" />
            La frase de la gente
          </p>
          <p className="display mt-4 max-w-4xl text-[26px] leading-snug sm:text-[32px]">“{quote}”</p>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Respuesta abierta{openQuestion ? ` · ${openQuestion.question.text}` : ""}
            {openQuestion?.topTerms[0] ? ` · se repite «${openQuestion.topTerms[0].term}»` : ""}
          </p>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Territorio</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {zoneFinding
                ? `${zoneFinding.column} no vota como el resto: «${zoneFinding.row}» está ${pp(zoneFinding.percent - zoneFinding.rest)} corrido.`
                : "Dónde está entrando la muestra. El departamento que se despegue de la opinión promedio se nombra arriba."}
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-2 sm:grid-cols-2">
          {zones.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin zonas cargadas en los casos.</p>
          ) : (
            zones.map((z) => {
              const spoken = zoneFinding?.column === z.name;
              return (
                <div key={z.name} className={spoken ? "rounded-2xl bg-[var(--primary-soft)] px-3 py-2" : ""}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="truncate font-medium">{z.name}</span>
                    <span className="tabular-nums font-semibold">{formatPercent(z.percent)}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-[var(--surface-2)]">
                    <div
                      className={`h-full rounded-full ${spoken ? "bg-[var(--accent)]" : "bg-[var(--primary)]"}`}
                      style={{ width: `${Math.min(100, z.percent)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Carga en tiempo real</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">Casos por día y el acumulado de las últimas dos semanas.</p>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <FieldTrend data={dash.days} height={280} />
        </CardContent>
      </Card>

      {questions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pregunta por pregunta</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {questions.slice(0, 4).map((q) => (
              <Card key={q.question.id}>
                <CardHeader>
                  <CardTitle className="text-[15px] leading-snug">{q.question.text}</CardTitle>
                  <p className="text-xs text-[var(--muted)]">
                    n = {formatNumber(q.answered)}
                    {q.net ? ` · saldo ${q.net.net > 0 ? "+" : ""}${Math.round(q.net.net)}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="pt-2">
                  <DistributionBars data={q.distribution.slice(0, 6)} multiple={q.multiple} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {recommendations.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--accent)]" />
              <CardTitle>Qué hacer con esto</CardTitle>
            </div>
            {report ? (
              <Link href={`/cliente/informes/${report.id}`} className="text-sm font-medium text-[var(--primary)]">
                Abrir el informe
              </Link>
            ) : null}
          </CardHeader>
          <CardContent className="pt-2">
            <ol className="space-y-3">
              {recommendations.map((item, i) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed">
                  <span className="display text-sm text-[var(--primary)]">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {dash.surveys.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Encuestas</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dash.surveys.slice(0, 6).map((s) => {
              const done = dash.countBySurvey.get(s.id) ?? 0;
              const pct = s.target_responses ? Math.round((done / s.target_responses) * 100) : 0;
              return (
                <Link
                  key={s.id}
                  href={`/cliente/encuestas/${s.id}/resultados`}
                  className="rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-4 shadow-[var(--shadow-card)] transition-colors hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border))]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{s.title}</p>
                    {s.status === "activa" ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--success)]">
                        <span className="size-1.5 animate-pulse rounded-full bg-current" />
                        En vivo
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--muted)]">{s.status}</span>
                    )}
                  </div>
                  <p className="mt-3 text-xs tabular-nums text-[var(--muted)]">
                    {formatNumber(done)} / {formatNumber(s.target_responses)} · {pct}%
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CompareBars({
  left,
  right,
}: {
  left: { label: string; percent: number };
  right: { label: string; percent: number };
}) {
  const max = Math.max(left.percent, right.percent, 1);
  return (
    <div className="space-y-3">
      {[left, right].map((bar) => (
        <div key={bar.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{bar.label}</span>
            <span className="tabular-nums font-semibold">{formatPercent(bar.percent)}</span>
          </div>
          <div className="mt-1.5 h-2.5 rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--primary)]"
              style={{ width: `${Math.min(100, (bar.percent / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
