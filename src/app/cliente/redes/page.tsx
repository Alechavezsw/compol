import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Flame, Info, Radar, Scale, TrendingDown, Trash2 } from "lucide-react";
import { EmptyState, Notice, PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { MoodTrend } from "@/components/charts/charts";
import { ImportPanel, PostFeed, ReclassifyButton, SocialFilterBar, TrackerForm } from "./panel";
import { deleteTrackerAction } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { computeSocial, moodLabel, type SocialAnalytics } from "@/lib/social/analytics";
import { classifyText } from "@/lib/social/lexicon";
import { getSurveyAnalytics } from "@/lib/analytics";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { addDays, todayKey } from "@/lib/stats";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { EMOTION_LABEL, NETWORK_LABEL, type SocialNetwork, type SocialPost, type SocialTracker } from "@/lib/types";

export const metadata: Metadata = { title: "Humor en redes" };

const NETWORKS: SocialNetwork[] = ["facebook", "x", "instagram", "tiktok", "youtube", "noticias", "otros"];

function MoodGauge({ value, previous }: { value: number; previous: number | null }) {
  const v = Math.max(-100, Math.min(100, value));
  const angle = ((v + 100) / 200) * 180; // 0 = izquierda (−100), 180 = derecha (+100)
  const rad = (Math.PI * (180 - angle)) / 180;
  const cx = 120;
  const cy = 118;
  const r = 96;
  const needle = { x: cx + Math.cos(rad) * (r - 18), y: cy - Math.sin(rad) * (r - 18) };
  const label = moodLabel(v);
  const delta = previous === null ? null : v - previous;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 136" className="w-full max-w-[280px]" role="img" aria-label={`Índice de humor ${Math.round(v)}`}>
        <defs>
          <linearGradient id="moodArc" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--danger)" />
            <stop offset="50%" stopColor="var(--warning)" />
            <stop offset="100%" stopColor="var(--success)" />
          </linearGradient>
        </defs>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--surface-2)" strokeWidth="18" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#moodArc)" strokeWidth="18" strokeLinecap="round" opacity="0.9" />
        {[-100, -50, 0, 50, 100].map((t) => {
          const a = (Math.PI * (180 - ((t + 100) / 200) * 180)) / 180;
          return (
            <line
              key={t}
              x1={cx + Math.cos(a) * (r + 12)}
              y1={cy - Math.sin(a) * (r + 12)}
              x2={cx + Math.cos(a) * (r + 16)}
              y2={cy - Math.sin(a) * (r + 16)}
              stroke="var(--muted)"
              strokeWidth="1.5"
            />
          );
        })}
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="var(--foreground)" strokeWidth="4" strokeLinecap="round" style={{ transition: "all 1s cubic-bezier(.22,1,.36,1)" }} />
        <circle cx={cx} cy={cy} r="8" fill="var(--foreground)" />
        <circle cx={cx} cy={cy} r="3" fill="var(--surface)" />
      </svg>
      <p className="display -mt-2 text-5xl leading-none tabular-nums text-[var(--foreground)]">
        {v > 0 ? "+" : ""}
        {Math.round(v)}
      </p>
      <Badge tone={label.tone} className="mt-2">
        {label.text}
      </Badge>
      {delta !== null ? (
        <p className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", delta >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
          {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {delta >= 0 ? "+" : ""}
          {Math.round(delta)} puntos vs. período anterior
        </p>
      ) : null}
    </div>
  );
}

function SplitBar({ split, total }: { split: SocialAnalytics["split"]; total: number }) {
  if (!total) return null;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
      <div className="bg-[var(--success)]" style={{ width: `${(split.positivo / total) * 100}%` }} />
      <div className="bg-[color-mix(in_oklab,var(--muted)_35%,transparent)]" style={{ width: `${(split.neutral / total) * 100}%` }} />
      <div className="bg-[var(--danger)]" style={{ width: `${(split.negativo / total) * 100}%` }} />
    </div>
  );
}

export default async function RedesPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; red?: string; tema?: string }>;
}) {
  const query = await searchParams;
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();
  const days = [7, 30, 90].includes(Number(query.dias)) ? Number(query.dias) : 30;
  const today = todayKey();
  const since = `${addDays(today, -(days * 2))}T00:00:00-03:00`;

  const [{ data: trackerRows }, posts, { data: surveyRows }] = await Promise.all([
    supabase.from("social_trackers").select("*").eq("organization_id", organization.id).order("created_at"),
    fetchAll<SocialPost>((from, to) =>
      supabase
        .from("social_posts")
        .select("*")
        .eq("organization_id", organization.id)
        .gte("published_at", new Date(since).toISOString())
        .order("published_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("surveys")
      .select("id, title, status")
      .eq("organization_id", organization.id)
      .neq("status", "borrador")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const trackers = (trackerRows ?? []) as SocialTracker[];
  const network = NETWORKS.includes(query.red as SocialNetwork) ? (query.red as SocialNetwork) : null;
  const a = computeSocial(posts, { days, network, topic: query.tema || null }, today);
  const canManage = profile.role === "org_admin";
  const pendingModel = posts.filter((p) => p.classified_by === "lexico").length;
  const allTopics = [...new Set(posts.flatMap((p) => p.topics))].sort((x, y) => x.localeCompare(y, "es"));

  // --- Agenda de la encuesta vs. agenda en redes ----------------------------
  let agenda: { label: string; survey: number; social: number }[] = [];
  let agendaSurvey: string | null = null;
  for (const s of surveyRows ?? []) {
    const analytics = await getSurveyAnalytics(supabase, s.id);
    const problems = analytics?.questions.find((q) => q.question.type === "opcion_multiple" && q.answered >= 30);
    if (!problems || !analytics) continue;
    agendaSurvey = s.title;
    agenda = problems.distribution
      .map((d) => {
        const topic = classifyText(d.name).topics[0];
        const social = topic ? (a.topics.find((t) => t.name === topic)?.share ?? 0) : null;
        return social === null ? null : { label: d.name, survey: d.percent, social };
      })
      .filter((x): x is { label: string; survey: number; social: number } => Boolean(x))
      .slice(0, 7);
    break;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Badge tone="accent">
            <Radar className="size-3" />
            Escucha social
          </Badge>
        }
        title="Humor en redes"
        description="Qué se dice de la gestión en redes y portales: sentimiento, temas, emociones y picos de conversación."
      />

      <SocialFilterBar topics={allTopics} networks={NETWORKS.filter((n) => posts.some((p) => p.network === n))} />

      {posts.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <EmptyState
            icon={<Radar className="size-5" />}
            title="Todavía no hay publicaciones"
            description="Importá un CSV de tu herramienta de monitoreo, pegá comentarios o conectá un feed de noticias para empezar a medir el humor."
          />
          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Importar publicaciones</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ImportPanel withModel={isGeminiConfigured()} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <>
          {a.alerts.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {a.alerts.map((al, i) => (
                <Link
                  key={i}
                  href={al.topic ? `?${new URLSearchParams({ ...(query.dias ? { dias: query.dias } : {}), tema: al.topic }).toString()}` : "#"}
                  scroll={false}
                  className={cn(
                    "flex gap-3 rounded-[20px] border p-4 transition-transform hover:-translate-y-0.5",
                    al.kind === "tema_emergente"
                      ? "border-[color-mix(in_oklab,var(--primary)_30%,var(--border))] bg-[var(--primary-soft)]"
                      : "border-[color-mix(in_oklab,var(--danger)_30%,var(--border))] bg-[var(--danger-soft)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl text-white",
                      al.kind === "tema_emergente" ? "bg-[var(--primary)]" : "bg-[var(--danger)]",
                    )}
                  >
                    {al.kind === "pico_negativo" ? <AlertTriangle className="size-4" /> : al.kind === "tema_emergente" ? <Flame className="size-4" /> : <TrendingDown className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-semibold", al.kind === "tema_emergente" ? "text-[var(--primary)]" : "text-[var(--danger)]")}>{al.title}</p>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--foreground)] opacity-80">{al.detail}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card className="relative overflow-hidden">
              <div className={cn("orb -top-16 left-1/2 size-56 -translate-x-1/2 opacity-15", a.mood >= 0 ? "bg-[var(--success)]" : "bg-[var(--danger)]")} />
              <CardContent className="relative p-6">
                <p className="text-center text-[13px] font-medium text-[var(--muted)]">Índice de humor · últimos {days} días</p>
                <div className="mt-3">
                  <MoodGauge value={a.mood} previous={a.previousMood} />
                </div>
                <div className="mt-5 space-y-2">
                  <SplitBar split={a.split} total={a.total} />
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-[var(--success)]">{formatPercent(a.total ? (a.split.positivo / a.total) * 100 : 0)} positivas</span>
                    <span className="text-[var(--danger)]">{formatPercent(a.total ? (a.split.negativo / a.total) * 100 : 0)} negativas</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-rows-[auto_1fr]">
              <StatCard
                label="Publicaciones"
                value={formatNumber(a.total)}
                icon={<Radar className="size-4" />}
                hint={a.previousTotal ? `${a.total >= a.previousTotal ? "+" : ""}${Math.round(((a.total - a.previousTotal) / a.previousTotal) * 100)}% vs. período anterior` : undefined}
              />
              <StatCard label="Interacciones" value={formatNumber(a.engagement)} icon={<Flame className="size-4" />} tone="accent" hint="Me gusta, comentarios y compartidos" />
              <StatCard
                label="Emoción dominante"
                value={a.emotions[0] ? EMOTION_LABEL[a.emotions[0].emotion] : "—"}
                icon={<Info className="size-4" />}
                tone="warning"
                hint={a.emotions[0] ? `${formatPercent(a.emotions[0].share)} de las que expresan una emoción` : undefined}
              />
              <Card className="sm:col-span-3">
                <CardHeader>
                  <div>
                    <CardTitle>Evolución del humor</CardTitle>
                    <p className="mt-1 text-sm text-[var(--muted)]">Publicaciones por día según sentimiento y el índice diario</p>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <MoodTrend data={a.daily} />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <div>
                  <CardTitle>Temas de la conversación</CardTitle>
                  <p className="mt-1 text-sm text-[var(--muted)]">Tocá un tema para filtrar todo el tablero.</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 pt-3">
                {a.topics.slice(0, 10).map((t) => {
                  const lbl = moodLabel(t.mood);
                  return (
                    <Link
                      key={t.name}
                      href={`?${new URLSearchParams({ ...(query.dias ? { dias: query.dias } : {}), ...(query.red ? { red: query.red } : {}), tema: t.name }).toString()}`}
                      scroll={false}
                      className={cn(
                        "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)] sm:grid-cols-[180px_1fr_auto]",
                        query.tema === t.name && "bg-[var(--primary-soft)]",
                      )}
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]">{t.name}</span>
                      <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                        <SplitBar split={t.split} total={t.volume} />
                      </span>
                      <span className="flex items-center justify-end gap-2 text-xs tabular-nums">
                        <span className="text-[var(--muted)]">{formatNumber(t.volume)}</span>
                        <span className={cn("w-9 text-right font-semibold", lbl.tone === "success" ? "text-[var(--success)]" : lbl.tone === "danger" ? "text-[var(--danger)]" : "text-[var(--warning)]")}>
                          {t.mood > 0 ? "+" : ""}
                          {Math.round(t.mood)}
                        </span>
                        {t.growth !== null ? (
                          <span className={cn("inline-flex w-12 items-center justify-end", t.growth >= 0 ? "text-[var(--primary)]" : "text-[var(--muted)]")}>
                            {t.growth >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                            {Math.abs(Math.round(t.growth))}%
                          </span>
                        ) : (
                          <span className="w-12 text-right text-[var(--primary)]">nuevo</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            <div className="space-y-4 xl:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Por red</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {a.byNetwork.map((n) => (
                    <div key={n.network}>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="font-medium text-[var(--foreground)]">{NETWORK_LABEL[n.network]}</span>
                        <span className="text-xs tabular-nums text-[var(--muted)]">
                          {formatNumber(n.volume)} ·{" "}
                          <strong className={n.mood >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                            {n.mood > 0 ? "+" : ""}
                            {Math.round(n.mood)}
                          </strong>
                        </span>
                      </div>
                      <SplitBar split={n.split} total={n.volume} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Palabras que más se repiten</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5 pt-4">
                  {a.terms.map((t) => (
                    <span
                      key={t.term}
                      className="rounded-full px-2.5 py-1 font-medium"
                      style={{
                        fontSize: `${Math.min(17, 11 + Math.sqrt(t.count))}px`,
                        color: t.mood > 15 ? "var(--success)" : t.mood < -15 ? "var(--danger)" : "var(--foreground)",
                        background: t.mood > 15 ? "var(--success-soft)" : t.mood < -15 ? "var(--danger-soft)" : "var(--surface-2)",
                      }}
                      title={`${t.count} publicaciones · humor ${t.mood}`}
                    >
                      {t.term}
                    </span>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>Qué se está diciendo</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <PostFeed negative={a.topNegative} positive={a.topPositive} recent={a.recent} now={new Date(`${today}T23:59:00-03:00`).getTime()} />
              </CardContent>
            </Card>

            <div className="space-y-4 xl:col-span-2">
              {agenda.length ? (
                <Card>
                  <CardHeader>
                    <div>
                      <div className="flex items-center gap-2">
                        <Scale className="size-4 text-[var(--muted)]" />
                        <CardTitle>Encuesta vs. redes</CardTitle>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Agenda de problemas en «{agendaSurvey}» comparada con el peso de cada tema en la conversación.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    {agenda.map((row) => {
                      const max = Math.max(...agenda.flatMap((x) => [x.survey, x.social]), 1);
                      return (
                        <div key={row.label}>
                          <p className="mb-1 text-xs font-medium text-[var(--foreground)]">{row.label}</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${(row.survey / max) * 100}%` }} />
                              <span className="text-[11px] tabular-nums text-[var(--muted)]">{Math.round(row.survey)}% encuesta</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(1, (row.social / max) * 100)}%` }} />
                              <span className="text-[11px] tabular-nums text-[var(--muted)]">{Math.round(row.social)}% redes</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <Notice className="mt-2 text-xs">
                      Las redes no son una muestra representativa: sobrerrepresentan a quienes están más enojados o más
                      comprometidos. Sirven para detectar temas y picos, no para medir la opinión general.
                    </Notice>
                  </CardContent>
                </Card>
              ) : null}

              {canManage ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Importar publicaciones</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ImportPanel withModel={isGeminiConfigured()} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>Temas que seguís</CardTitle>
                        <p className="mt-1 text-xs text-[var(--muted)]">Se suman a los temas generales de gestión.</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {trackers.map((t) => (
                        <div key={t.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--foreground)]">{t.name}</p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">{t.keywords.join(", ")}</p>
                          </div>
                          <form action={deleteTrackerAction}>
                            <input type="hidden" name="id" value={t.id} />
                            <button type="submit" aria-label="Dejar de seguir" className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]">
                              <Trash2 className="size-4" />
                            </button>
                          </form>
                        </div>
                      ))}
                      <TrackerForm />
                      {isGeminiConfigured() && pendingModel ? <ReclassifyButton pending={pendingModel} /> : null}
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
