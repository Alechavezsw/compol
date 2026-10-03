import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ImportPanel,
  ListenButton,
  MetaListenButton,
  PostFeed,
  ReclassifyButton,
  SocialFilterBar,
  SourceForm,
  TrackerForm,
} from "./panel";
import { deleteSourceAction, deleteTrackerAction } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { computeSocial, moodLabel } from "@/lib/social/analytics";
import { addDays, todayKey } from "@/lib/stats";
import { cn, formatDateTime, formatNumber, formatPercent } from "@/lib/utils";
import {
  type SocialImport,
  type SocialNetwork,
  type SocialPost,
  type SocialSource,
  type SocialTracker,
} from "@/lib/types";

export const metadata: Metadata = { title: "Radar de conversación" };

const NETWORKS: SocialNetwork[] = ["facebook", "x", "instagram", "tiktok", "youtube", "noticias", "otros"];

function SplitBar({ split, total }: { split: { positivo: number; neutral: number; negativo: number }; total: number }) {
  if (!total) return null;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
      <div className="bg-[var(--success)]" style={{ width: `${(split.positivo / total) * 100}%` }} />
      <div className="bg-[color-mix(in_oklab,var(--muted)_40%,transparent)]" style={{ width: `${(split.neutral / total) * 100}%` }} />
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
  const days = [1, 7, 30, 90].includes(Number(query.dias)) ? Number(query.dias) : 30;
  const today = todayKey();
  const since = `${addDays(today, -(days * 2))}T00:00:00-03:00`;

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
  const network = NETWORKS.includes(query.red as SocialNetwork) ? (query.red as SocialNetwork) : null;
  const a = computeSocial(posts, { days, network, topic: query.tema || null }, today);
  const canManage = profile.role === "org_admin";
  const pendingLexicon = posts.filter((p) => p.classified_by === "lexico").length;
  const allTopics = [...new Set(posts.flatMap((p) => p.topics))].sort((x, y) => x.localeCompare(y, "es"));
  const mood = moodLabel(a.mood);
  const lastSync = sources.map((s) => s.last_fetched_at).filter(Boolean).sort().at(-1) ?? imports[0]?.created_at;
  const favor = a.total ? (a.split.positivo / a.total) * 100 : 0;
  const contra = a.total ? (a.split.negativo / a.total) * 100 : 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">Radar</p>
          <h1 className="display mt-1 text-[34px] leading-none text-[var(--foreground)]">Qué se dice de la gestión</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Encendé el radar: recorre portales de San Juan, guarda notas reales y muestra el tono.
          </p>
        </div>
        {canManage ? (
          <div className="shrink-0">
            <ListenButton />
            {lastSync ? (
              <p suppressHydrationWarning className="mt-2 text-right text-[11px] text-[var(--muted)]">
                Última búsqueda {formatDateTime(lastSync)}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      {a.total === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="display text-2xl">Todavía no hay notas</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
              El botón de arriba busca noticias públicas de {organization.name} y de tus temas, y las deja en la base.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <SocialFilterBar topics={allTopics} networks={NETWORKS.filter((n) => posts.some((p) => p.network === n))} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Notas", formatNumber(a.total), query.tema ? `Sobre ${query.tema}` : days === 1 ? "Hoy" : `Últimos ${days} días`],
              ["Tono", `${a.mood > 0 ? "+" : ""}${Math.round(a.mood)}`, mood.text],
              ["A favor", formatPercent(favor), `${formatNumber(a.split.positivo)} notas`],
              ["En contra", formatPercent(contra), `${formatNumber(a.split.negativo)} notas`],
            ].map(([label, value, hint]) => (
              <div
                key={label}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4"
              >
                <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
                <p className="display mt-2 text-[28px] leading-none tabular-nums">{value}</p>
                <p className="mt-2 text-[11px] text-[var(--muted)]">{hint}</p>
              </div>
            ))}
          </div>

          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Temas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-4">
                {a.topics.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Esta búsqueda no trajo temas claros todavía.</p>
                ) : (
                  a.topics.slice(0, 6).map((t) => {
                    const lbl = moodLabel(t.mood);
                    return (
                      <Link
                        key={t.name}
                        href={`?${new URLSearchParams({
                          ...(query.dias ? { dias: query.dias } : {}),
                          ...(query.red ? { red: query.red } : {}),
                          tema: t.name,
                        }).toString()}`}
                        scroll={false}
                        className={cn(
                          "flex items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-2)]",
                          query.tema === t.name && "bg-[var(--primary-soft)]",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{t.name}</span>
                          <span className="mt-1.5 block">
                            <SplitBar split={t.split} total={t.volume} />
                          </span>
                        </span>
                        <span className="w-14 shrink-0 text-right">
                          <span className="block text-xs tabular-nums text-[var(--muted)]">{formatNumber(t.volume)}</span>
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              lbl.tone === "success"
                                ? "text-[var(--success)]"
                                : lbl.tone === "danger"
                                  ? "text-[var(--danger)]"
                                  : "text-[var(--warning)]",
                            )}
                          >
                            {t.mood > 0 ? "+" : ""}
                            {Math.round(t.mood)}
                          </span>
                        </span>
                      </Link>
                    );
                  })
                )}
                {query.tema ? (
                  <Link href="/cliente/redes" className="mt-2 block px-3 text-xs text-[var(--primary)]">
                    Ver todos los temas
                  </Link>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex w-full items-center justify-between gap-3">
                  <CardTitle>Notas</CardTitle>
                  <Badge tone={mood.tone}>{mood.text}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="max-h-[520px] overflow-y-auto pr-1">
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
        </>
      )}

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
