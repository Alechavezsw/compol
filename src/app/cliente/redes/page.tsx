import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronDown, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RankBars, ToneLegend, type LikertRow } from "@/components/pulse/bars";
import { AnimatedNumber } from "@/components/pulse/motion";
import { SocialBars } from "@/components/pulse/trends";
import { MoodLine, ToneFilterBars } from "./radar-charts";
import {
  ImportPanel,
  MetaListenButton,
  PostFeed,
  RadarActionBar,
  ReclassifyButton,
  SocialFilterBar,
  SourceForm,
  TrackerForm,
} from "./panel";
import { deleteSourceAction, deleteTrackerAction } from "./actions";
import { persistMissingTopics } from "@/lib/social/persist-topics";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { computeSocial, countCaptured, moodLabel } from "@/lib/social/analytics";
import { signed } from "@/lib/pulse";
import { addDays, todayKey } from "@/lib/stats";
import { formatDateTime, formatNumber } from "@/lib/utils";
import {
  EMOTION_LABEL,
  NETWORK_LABEL,
  type SocialImport,
  type SocialNetwork,
  type SocialPost,
  type SocialSource,
  type SocialTracker,
} from "@/lib/types";

export const metadata: Metadata = { title: "Radar de conversación" };

const NETWORKS: SocialNetwork[] = ["facebook", "x", "instagram", "tiktok", "youtube", "noticias", "otros"];

/** Reparto de un tema o una red en las tres columnas de tono, listo para dibujar. */
function toneShares(split: { positivo: number; neutral: number; negativo: number }, volume: number) {
  const part = (count: number) => (volume ? (count / volume) * 100 : 0);
  return [
    { index: 0, label: "En contra", tone: "muy_neg" as const, count: split.negativo, percent: part(split.negativo) },
    { index: 1, label: "Neutras", tone: "neutro" as const, count: split.neutral, percent: part(split.neutral) },
    { index: 2, label: "A favor", tone: "muy_pos" as const, count: split.positivo, percent: part(split.positivo) },
  ];
}

const notes = (count: number) => `${formatNumber(count)} ${count === 1 ? "nota" : "notas"}`;

function Delta({ value, unit, against }: { value: number | null; unit: string; against: string }) {
  if (value === null || Math.round(value) === 0) return null;
  return (
    <span className="mt-1 flex items-center gap-1 font-semibold text-[var(--foreground)]">
      {value > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
      {signed(value)} {Math.abs(Math.round(value)) === 1 ? unit.replace(/s$/, "") : unit} contra {against}
    </span>
  );
}

export default async function RedesPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; red?: string; tema?: string; q?: string }>;
}) {
  const query = await searchParams;
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();
  const days = [1, 7, 30].includes(Number(query.dias)) ? Number(query.dias) : 1;
  const today = todayKey();
  const since = `${addDays(today, -30)}T00:00:00-03:00`;

  const [{ data: trackerRows }, { data: sourceRows }, { data: importRows }, posts] = await Promise.all([
    supabase.from("social_trackers").select("*").eq("organization_id", organization.id).order("created_at"),
    supabase.from("social_sources").select("*").eq("organization_id", organization.id).order("created_at"),
    supabase
      .from("social_imports")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(5),
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
  ]);

  const trackers = (trackerRows ?? []) as SocialTracker[];
  const sources = (sourceRows ?? []) as SocialSource[];
  const imports = (importRows ?? []) as SocialImport[];
  const tagged = await persistMissingTopics(supabase, organization.id, posts, trackers);
  const network = NETWORKS.includes(query.red as SocialNetwork) ? (query.red as SocialNetwork) : null;
  const filters = { days, network, topic: query.tema || null, q: query.q || null };
  const a = computeSocial(tagged, filters, today);
  // La evolución mira por lo menos dos semanas: un solo día no dibuja nada.
  const trend = computeSocial(tagged, { ...filters, days: Math.max(days, 14) }, today);
  const periodCounts = {
    1: countCaptured(tagged, 1, today),
    7: countCaptured(tagged, 7, today),
    30: countCaptured(tagged, 30, today),
  };
  const canManage = profile.role === "org_admin";
  const pendingLexicon = tagged.filter((p) => p.classified_by === "lexico").length;
  const allTopics = [...new Set(tagged.flatMap((p) => p.topics))].sort((x, y) => x.localeCompare(y, "es"));
  const mood = moodLabel(a.mood);
  const lastSync = sources.map((s) => s.last_fetched_at).filter(Boolean).sort().at(-1) ?? imports[0]?.created_at;
  const favor = a.total ? (a.split.positivo / a.total) * 100 : 0;
  const contra = a.total ? (a.split.negativo / a.total) * 100 : 0;
  const before = days === 1 ? "ayer" : `los ${days} días previos`;
  // El filtro por tema deja solo ese tema en la cuenta; para comparar se muestran todos.
  const everyTopic = query.tema ? computeSocial(tagged, { ...filters, topic: null }, today) : a;
  const everyNetwork = network ? computeSocial(tagged, { ...filters, network: null }, today) : a;
  const topicRows: LikertRow[] = everyTopic.topics.slice(0, 8).map((t) => ({
    key: t.name,
    label: t.name,
    shares: toneShares(t.split, t.volume),
    net: t.mood,
    base: t.volume,
  }));
  const networkRows: LikertRow[] = everyNetwork.byNetwork.map((n) => ({
    key: n.network,
    label: NETWORK_LABEL[n.network],
    shares: toneShares(n.split, n.volume),
    net: n.mood,
    base: n.volume,
  }));
  const topTerm = Math.max(1, ...a.terms.map((t) => t.count));
  const searchTerm = (term: string) =>
    `?${new URLSearchParams({ ...(query.dias ? { dias: query.dias } : {}), q: term }).toString()}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">Radar</p>
          <h1 className="display mt-1 text-[34px] leading-none text-[var(--foreground)]">Qué se dice de la gestión</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Encendé el radar, revisá las notas y guardalas. Cada guardado suma a Hoy, a la semana y al mes.
          </p>
        </div>
        <RadarActionBar canListen={canManage} days={days} notes={a.total} lastSync={lastSync} />
      </header>

      <SocialFilterBar
        topics={allTopics}
        networks={NETWORKS.filter((n) => posts.some((p) => p.network === n))}
        counts={periodCounts}
      />

      {a.total === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="display text-2xl">{query.q ? "Nada para esa búsqueda" : "Todavía no hay notas en este recorte"}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
              {query.q
                ? "Probá otro término o encendé el radar para buscarlo en los portales."
                : `Encendé el radar para buscar notas de ${organization.name}. Guardalas y van a aparecer en Hoy.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="animate-rise grid gap-4 xl:grid-cols-5">
          <Card className="p-6 xl:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">Tono de la conversación</p>
              <Badge tone={mood.tone}>{mood.text}</Badge>
            </div>
            <p className="mt-3 text-6xl font-semibold tracking-tight text-[var(--foreground)]">
              <AnimatedNumber value={a.mood} as="saldo" />
            </p>
            <div className="relative mt-5 h-3" role="meter" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(a.mood)} aria-label="Tono de la conversación">
              <div className="flex h-full gap-0.5 overflow-hidden rounded-full">
                <span className="w-[45%] bg-[var(--eval-neg)] opacity-60" />
                <span className="w-[10%] bg-[var(--eval-neutro)]" />
                <span className="w-[45%] bg-[var(--eval-pos)] opacity-60" />
              </div>
              <span
                className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[var(--surface)] bg-[var(--foreground)] shadow transition-[left] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ left: `${(Math.max(-100, Math.min(100, a.mood)) + 100) / 2}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
              <span>−100 en contra</span>
              <span>a favor +100</span>
            </div>
            <div className="mt-3 text-xs text-[var(--muted)]">
              <Delta value={a.previousMood === null ? null : a.mood - a.previousMood} unit="puntos" against={before} />
              <p className="mt-2">Pesa más lo que tuvo más interacciones.</p>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:col-span-3">
            {[
              {
                label: "Notas",
                value: a.total,
                as: "entero" as const,
                hint: query.q ? `«${query.q}»` : query.tema ? `Sobre ${query.tema}` : days === 1 ? "Hoy" : `Últimos ${days} días`,
                delta: a.previousTotal ? a.total - a.previousTotal : null,
              },
              { label: "Interacciones", value: a.engagement, as: "entero" as const, hint: "Me gusta, comentarios y compartidos", delta: null },
              { label: "A favor", value: favor, as: "porcentaje" as const, hint: notes(a.split.positivo), delta: null },
              { label: "En contra", value: contra, as: "porcentaje" as const, hint: notes(a.split.negativo), delta: null },
            ].map((tile) => (
              <Card key={tile.label} className="p-5">
                <p className="text-sm text-[var(--muted)]">{tile.label}</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
                  <AnimatedNumber value={tile.value} as={tile.as} />
                </p>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  {tile.hint}
                  <Delta value={tile.delta} unit="notas" against={before} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {a.alerts.length ? (
        <ul className="animate-rise grid gap-3 md:grid-cols-2 [animation-delay:80ms]">
          {a.alerts.slice(0, 4).map((alert) => (
            <li key={`${alert.kind}-${alert.title}`} className="flex items-start gap-3 rounded-2xl bg-[var(--danger-soft)] p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--danger)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{alert.title}</p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{alert.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {trend.total ? (
        <div className="animate-rise grid items-start gap-4 [animation-delay:120ms] xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Cuánto se habló</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Notas por día, según su tono. Últimos {Math.max(days, 14)} días.</p>
              </div>
            </CardHeader>
            <CardContent>
              <SocialBars data={trend.daily} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Cómo cambió el tono</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Un punto por cada día con al menos tres notas.</p>
              </div>
            </CardHeader>
            <CardContent>
              <MoodLine data={trend.daily.map((d) => ({ name: d.name, mood: d.mood, total: d.positivo + d.neutral + d.negativo }))} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {a.total ? (
        <>
          <div className="animate-rise grid items-start gap-4 [animation-delay:160ms] xl:grid-cols-2">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>De qué se habla</CardTitle>
                    <p className="mt-1 text-sm text-[var(--muted)]">Tocá un tema para ver solo sus notas.</p>
                  </div>
                </CardHeader>
                <CardContent>
                  {topicRows.length ? (
                    <>
                      <ToneLegend shares={topicRows[0].shares} />
                      <div className="mt-4">
                        <ToneFilterBars rows={topicRows} param="tema" selected={query.tema || null} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">Esta búsqueda no trajo temas claros todavía.</p>
                  )}
                </CardContent>
              </Card>

              {networkRows.length > 1 ? (
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Dónde se habla</CardTitle>
                      <p className="mt-1 text-sm text-[var(--muted)]">Tono en cada fuente.</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ToneFilterBars rows={networkRows} param="red" selected={network} />
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <Card>
              <CardHeader>
                <div className="flex w-full items-center justify-between gap-3">
                  <CardTitle>Notas</CardTitle>
                  <Badge tone={mood.tone}>{mood.text}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="max-h-[720px] overflow-y-auto pr-1">
                  <PostFeed
                    negative={a.topNegative}
                    positive={a.topPositive}
                    recent={a.recent}
                    now={new Date(`${today}T23:59:00-03:00`).getTime()}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="animate-rise grid items-start gap-4 [animation-delay:200ms] xl:grid-cols-2">
            {a.emotions.length ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Con qué ánimo</CardTitle>
                    <p className="mt-1 text-sm text-[var(--muted)]">Emoción detectada, sobre las notas que muestran alguna.</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <RankBars
                    shares={a.emotions.map((e, index) => ({
                      index,
                      label: EMOTION_LABEL[e.emotion],
                      tone: "sin_dato" as const,
                      count: e.count,
                      percent: e.share,
                    }))}
                  />
                </CardContent>
              </Card>
            ) : null}
            {a.terms.length ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Palabras que se repiten</CardTitle>
                    <p className="mt-1 text-sm text-[var(--muted)]">El tamaño indica cuántas veces aparecen; el punto, su tono. Tocá una para buscarla.</p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  {a.terms.slice(0, 28).map((t) => (
                    <Link
                      key={t.term}
                      href={searchTerm(t.term)}
                      scroll={false}
                      title={`${t.count} menciones, tono ${signed(t.mood)}`}
                      className={`inline-flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1.5 font-medium text-[var(--foreground)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[var(--primary-soft)] ${
                        t.count / topTerm > 0.66 ? "text-xl" : t.count / topTerm > 0.4 ? "text-base" : "text-sm"
                      }`}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ background: t.mood >= 10 ? "var(--eval-muy-pos)" : t.mood <= -10 ? "var(--eval-muy-neg)" : "var(--eval-neutro)" }}
                      />
                      {t.term}
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </>
      ) : null}

      {canManage ? (
        <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
            Ajustes: fuentes, temas y carga manual
            <ChevronDown className="size-4 text-[var(--muted)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-6 border-t border-[var(--border)] p-5 lg:grid-cols-3">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Fuentes</p>
              {sources.map((s) => (
                <div key={s.id} className="flex items-start gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="truncate text-[11px] text-[var(--muted)]">{s.kind === "noticias" ? s.query : s.url}</p>
                  </div>
                  <form action={deleteSourceAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" aria-label="Quitar fuente" className="text-[var(--muted)] hover:text-[var(--danger)]">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              ))}
              <SourceForm />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Temas</p>
              {trackers.map((t) => (
                <div key={t.id} className="flex items-start gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="truncate text-[11px] text-[var(--muted)]">{t.keywords.join(", ")}</p>
                  </div>
                  <form action={deleteTrackerAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" aria-label="Quitar tema" className="text-[var(--muted)] hover:text-[var(--danger)]">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              ))}
              <TrackerForm />
              <ReclassifyButton pending={pendingLexicon} />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">Carga extra</p>
              <MetaListenButton />
              <ImportPanel />
              {imports.length ? (
                <ul className="space-y-1.5 text-[11px] text-[var(--muted)]">
                  {imports.map((row) => (
                    <li key={row.id}>
                      {formatDateTime(row.created_at)} · {row.inserted} nuevas
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
