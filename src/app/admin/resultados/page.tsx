import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  ClipboardList,
  IdCard,
  MapPin,
  Radar,
  Sparkles,
  Cpu,
} from "lucide-react";
import { EmptyState, PageHeader, Progress, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { Badge, SurveyStatusBadge } from "@/components/ui/badge";
import { FieldMap, type FieldMapPoint } from "@/components/results/field-map";
import { LiveRefresh } from "@/components/results/live-refresh";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getAiLayerStatus } from "@/lib/ai/gateway";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { Survey } from "@/lib/types";

export const metadata: Metadata = { title: "Resultados" };

type SurveyRow = Survey & { organizations: { name: string } | null };

type ResponseGeo = {
  id: string;
  survey_id: string;
  channel: "campo" | "web";
  zone: string | null;
  latitude: number | null;
  longitude: number | null;
  submitted_at: string | null;
  status: string;
};

type SocialClassified = { classified_by: string };
type AiCallRow = { provider: string; status: string; action: string; created_at: string };

function classifierBucket(raw: string) {
  const v = raw.toLowerCase();
  if (v.includes("jev") || v.includes("typesafe")) return "jev" as const;
  if (v.includes("gemini")) return "gemini" as const;
  if (v.includes("lexico") || v.includes("demo")) return "local" as const;
  return "otro" as const;
}

export default async function AdminResultadosPage() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const [aiStatus, surveysRes, responses, socialRows, medicionesCount, reportsCount, recentAi] =
    await Promise.all([
      getAiLayerStatus().catch(() => ({
        gemini: false,
        jev: false,
        geminiModel: null,
        jevModel: null,
      })),
      supabase
        .from("surveys")
        .select("*, organizations(name)")
        .order("updated_at", { ascending: false })
        .limit(40),
      fetchAll<ResponseGeo>((from, to) =>
        supabase
          .from("responses")
          .select("id, survey_id, channel, zone, latitude, longitude, submitted_at, status")
          .eq("status", "completada")
          .order("id")
          .range(from, to),
      ),
      fetchAll<SocialClassified>((from, to) =>
        supabase.from("social_posts").select("classified_by").order("id").range(from, to),
      ),
      supabase.from("dirigente_mediciones").select("id", { count: "exact", head: true }),
      supabase.from("ai_reports").select("id", { count: "exact", head: true }),
      supabase
        .from("ai_calls")
        .select("provider, status, action, created_at")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const surveys = (surveysRes.data ?? []) as SurveyRow[];
  const counts = new Map<string, number>();
  const geoBySurvey = new Map<string, number>();
  for (const r of responses) {
    counts.set(r.survey_id, (counts.get(r.survey_id) ?? 0) + 1);
    if (r.latitude != null && r.longitude != null) {
      geoBySurvey.set(r.survey_id, (geoBySurvey.get(r.survey_id) ?? 0) + 1);
    }
  }

  const active = surveys.filter((s) => s.status === "activa");
  const campo = responses.filter((r) => r.channel === "campo").length;
  const web = responses.filter((r) => r.channel === "web").length;

  const classifier = { jev: 0, gemini: 0, local: 0, otro: 0 };
  for (const row of socialRows) {
    classifier[classifierBucket(row.classified_by)] += 1;
  }

  const mapPoints: FieldMapPoint[] = responses
    .filter((r) => r.latitude != null && r.longitude != null)
    .slice(-2500)
    .map((r) => ({
      id: r.id,
      lat: r.latitude as number,
      lng: r.longitude as number,
      zone: r.zone,
      channel: r.channel,
      submittedAt: r.submitted_at,
      tone: "sin_dato" as const,
      toneLabel: r.channel === "campo" ? "Campo" : "Web",
    }));

  const live = active.length > 0;
  const aiCalls = (recentAi.data ?? []) as AiCallRow[];

  const measurementTiles = [
    {
      key: "campo",
      title: "Encuestas de campo",
      value: formatNumber(campo),
      hint: "Casos con encuestador",
      href: "/admin/encuestas",
      icon: <ClipboardList className="size-4" />,
    },
    {
      key: "web",
      title: "Encuestas web",
      value: formatNumber(web),
      hint: "Respuestas digitales",
      href: "/admin/encuestas",
      icon: <BarChart3 className="size-4" />,
    },
    {
      key: "radar",
      title: "Radar de conversación",
      value: formatNumber(socialRows.length),
      hint: `${formatNumber(classifier.jev)} JEV · ${formatNumber(classifier.gemini)} Gemini`,
      href: "/cliente/redes",
      icon: <Radar className="size-4" />,
    },
    {
      key: "dirigentes",
      title: "Dirigentes",
      value: formatNumber(medicionesCount.count ?? 0),
      hint: "Mediciones de imagen",
      href: "/cliente/dirigentes",
      icon: <IdCard className="size-4" />,
    },
    {
      key: "informes",
      title: "Informes",
      value: formatNumber(reportsCount.count ?? 0),
      hint: "Biblioteca con lectura política",
      href: "/cliente/informes",
      icon: <Sparkles className="size-4" />,
    },
    {
      key: "mapa",
      title: "Puntos en mapa",
      value: formatNumber(mapPoints.length),
      hint: "Casos con GPS",
      href: "#mapa-mediciones",
      icon: <MapPin className="size-4" />,
    },
  ];

  return (
    <div className="space-y-7">
      {live ? <LiveRefresh intervalMs={45_000} /> : null}

      <PageHeader
        eyebrow={
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
            Mediciones en vivo
          </p>
        }
        title="Resultados"
        description="Mapa de todas las mediciones de la plataforma: campo, web, radar, dirigentes e informes. JEV clasifica conversación; Gemini interpreta y redacta."
      />

      <section
        aria-label="Capa de inteligencia"
        className="grid gap-3 sm:grid-cols-2"
      >
        <Card className="overflow-hidden">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <Cpu className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[var(--foreground)]">JEV</p>
                <Badge tone={aiStatus.jev ? "success" : "warning"}>
                  {aiStatus.jev ? "En línea" : "Sin clave"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Clasifica sentimiento, emoción y temas del radar.
                {aiStatus.jevModel ? ` Modelo ${aiStatus.jevModel}.` : ""}
              </p>
              <p className="mt-2 text-xs font-medium text-[var(--foreground)]">
                {formatNumber(classifier.jev)} notas etiquetadas
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[var(--foreground)]">Gemini</p>
                <Badge tone={aiStatus.gemini ? "success" : "warning"}>
                  {aiStatus.gemini ? "En línea" : "Sin clave / sin crédito"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Completa clasificación del radar y genera informes y respuestas sobre agregados.
                {aiStatus.geminiModel ? ` Modelo ${aiStatus.geminiModel}.` : ""}
              </p>
              <p className="mt-2 text-xs font-medium text-[var(--foreground)]">
                {formatNumber(classifier.gemini)} notas · {formatNumber(reportsCount.count ?? 0)} informes
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="tipos-medicion">
        <h2 id="tipos-medicion" className="display mb-4 text-2xl text-[var(--foreground)]">
          Mapa de mediciones
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {measurementTiles.map((tile) => (
            <StatCard
              key={tile.key}
              label={tile.title}
              value={tile.value}
              hint={tile.hint}
              icon={tile.icon}
              href={tile.href}
            />
          ))}
        </div>
      </section>

      <section id="mapa-mediciones" aria-labelledby="mapa-titulo" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="mapa-titulo" className="display text-2xl text-[var(--foreground)]">
              Territorio en tiempo real
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Casos completados con GPS en toda la plataforma
              {live ? " · se actualiza solo mientras hay operativos activos" : ""}.
            </p>
          </div>
          {live ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              {formatNumber(active.length)} en campo
            </span>
          ) : null}
        </div>
        {mapPoints.length === 0 ? (
          <EmptyState
            icon={<MapPin className="size-5" />}
            title="Todavía no hay puntos geolocalizados"
            description="Cuando el campo comparta GPS, el mapa se llena solo."
          />
        ) : (
          <Card>
            <CardContent className="p-3 sm:p-4">
              <FieldMap points={mapPoints} />
            </CardContent>
          </Card>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Operativos con resultados</CardTitle>
            <Link href="/admin/encuestas" className="text-sm font-medium text-[var(--primary)] hover:underline">
              Ver todas
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {surveys.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">No hay encuestas cargadas.</p>
            ) : (
              <TableWrap>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <Th>Encuesta</Th>
                      <Th>Estado</Th>
                      <Th className="w-40">Avance</Th>
                      <Th className="text-right">Resultados</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveys.slice(0, 12).map((s) => {
                      const done = counts.get(s.id) ?? 0;
                      const pct = s.target_responses ? (done / s.target_responses) * 100 : 0;
                      const withGeo = geoBySurvey.get(s.id) ?? 0;
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                        >
                          <Td>
                            <p className="font-medium text-[var(--foreground)]">{s.title}</p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">
                              {s.organizations?.name ?? "—"}
                              {withGeo ? ` · ${formatNumber(withGeo)} en mapa` : ""}
                            </p>
                          </Td>
                          <Td>
                            <SurveyStatusBadge status={s.status} endsAt={s.ends_at} />
                          </Td>
                          <Td>
                            <div className="space-y-1">
                              <Progress value={pct} />
                              <p className="text-[11px] text-[var(--muted)] tabular-nums">
                                {formatNumber(done)}
                                {s.target_responses ? ` / ${formatNumber(s.target_responses)}` : ""}
                              </p>
                            </div>
                          </Td>
                          <Td className="text-right">
                            <Link
                              href={`/cliente/encuestas/${s.id}/resultados`}
                              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
                            >
                              <Activity className="size-3.5" />
                              Abrir
                            </Link>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Actividad JEV · Gemini</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {aiCalls.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">
                Todavía no hay llamadas registradas a la capa de IA.
              </p>
            ) : (
              <ul className="space-y-2">
                {aiCalls.map((call, i) => (
                  <li
                    key={`${call.created_at}-${i}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize text-[var(--foreground)]">
                        {call.provider === "none" ? "Sin proveedor" : call.provider} · {call.action}
                      </p>
                      <p suppressHydrationWarning className="text-[11px] text-[var(--muted)]">
                        {formatDateTime(call.created_at)}
                      </p>
                    </div>
                    <Badge tone={call.status === "ok" ? "success" : "danger"}>{call.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
