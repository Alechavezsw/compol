import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  CircleDot,
  ClipboardList,
  Copy,
  Gauge,
  GitBranch,
  Globe,
  Hash,
  ShieldCheck,
  Sparkles,
  StopCircle,
  Target,
  ToggleLeft,
  Trash2,
  Type,
  Users,
  X,
} from "lucide-react";
import { EmptyState, Notice, PageHeader, Progress, ProgressRing } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, SurveyStatusBadge } from "@/components/ui/badge";
import { QuestionForm, type BranchSource } from "./question-form";
import { QuestionEditor } from "./question-editor";
import { WebChannelCard } from "./web-channel-card";
import {
  clearLogicAction,
  copyQuestionnaireAction,
  deleteQuestionAction,
  duplicateSurveyAction,
  moveQuestionAction,
  updateSurveyStatusAction,
} from "../../actions";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { loadQuestions } from "@/lib/questions";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { describeCondition, isBranchable, isExclusiveOption, maxChoices } from "@/lib/survey-logic";
import { NOTICES, STATUS_FLOW, transitionLabel } from "@/lib/survey-status";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { QUESTION_TYPE_LABEL, type QuestionType, type Survey, type SurveyStatus } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("surveys").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Encuesta" };
}

export default async function EncuestaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const { data: surveyRow } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!surveyRow) notFound();
  const survey = surveyRow as Survey;

  const [questions, { data: assignmentRows }, responses, { data: otherSurveys }, h] = await Promise.all([
    loadQuestions(supabase, id),
    supabase.from("survey_assignments").select("*, profiles(id, full_name, is_active)").eq("survey_id", id),
    fetchAll<{ status: string; channel: string; surveyor_id: string | null }>((from, to) =>
      supabase.from("responses").select("status, channel, surveyor_id").eq("survey_id", id).order("id").range(from, to),
    ),
    supabase
      .from("surveys")
      .select("id, title")
      .eq("organization_id", organization.id)
      .neq("id", id)
      .order("updated_at", { ascending: false }),
    headers(),
  ]);

  const assignments = assignmentRows ?? [];
  const completed = responses.filter((r) => r.status === "completada");
  const webCount = completed.filter((r) => r.channel === "web").length;
  const doneBySurveyor = new Map<string, number>();
  for (const r of completed) if (r.surveyor_id) doneBySurveyor.set(r.surveyor_id, (doneBySurveyor.get(r.surveyor_id) ?? 0) + 1);

  const canManage = profile.role === "org_admin";
  const byId = new Map(questions.map((q) => [q.id, q]));
  const totalQuota = assignments.reduce((s, a) => s + a.quota, 0);
  const notice = aviso ? NOTICES[aviso] : null;
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3010"}`;

  const sources: BranchSource[] = questions.filter(isBranchable).map((q) => ({
    id: q.id,
    position: q.position,
    text: q.text,
    type: q.type,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
  }));

  // --- checklist para salir a campo ----------------------------------------
  const brokenLogic = questions.some((q) => {
    const parent = q.logic?.show_if ? byId.get(q.logic.show_if.question_id) : null;
    return q.logic?.show_if && (!parent || parent.position >= q.position);
  });
  const checklist = [
    { ok: questions.length > 0, label: "Cuestionario con al menos una pregunta", detail: plural(questions.length, "pregunta", "preguntas") },
    { ok: !brokenLogic, label: "Saltos consistentes", detail: brokenLogic ? "Hay condiciones rotas" : "Sin problemas" },
    {
      ok: survey.web_enabled || totalQuota >= survey.target_responses,
      label: survey.web_enabled ? "Canal web habilitado" : "Cuotas que cubren la meta",
      detail: survey.web_enabled
        ? "Recibe respuestas sin encuestador"
        : `${formatNumber(totalQuota)} de ${formatNumber(survey.target_responses)} · lo asigna la administración central`,
      soft: true,
    },
    { ok: Boolean(survey.ends_at), label: "Fecha de cierre", detail: survey.ends_at ? formatDate(survey.ends_at) : "Sin definir", soft: true },
  ];
  const blocking = checklist.filter((c) => !c.ok && !c.soft).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <SurveyStatusBadge status={survey.status} />
            {survey.web_enabled ? (
              <Badge tone="accent">
                <Globe className="size-3" />
                Canal web
              </Badge>
            ) : null}
          </div>
        }
        title={survey.title}
        description={survey.description ?? undefined}
        actions={
          <>
            <ButtonLink href={`/cliente/encuestas/${id}/resultados`} variant="outline">
              <BarChart3 />
              Resultados
            </ButtonLink>
            {canManage ? (
              <form action={duplicateSurveyAction}>
                <input type="hidden" name="id" value={id} />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                  title="Crea una encuesta en borrador con el mismo cuestionario"
                >
                  <Copy className="size-4" />
                  Nueva ola
                </button>
              </form>
            ) : null}
            {canManage && completed.length >= 10 ? (
              <ButtonLink href={`/cliente/informes?encuesta=${id}`}>
                <Sparkles />
                Generar informe
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      {/* ------------------------------------------------ estado y avance */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6 p-5 sm:p-6">
            <ProgressRing value={completed.length} max={survey.target_responses} size={104} stroke={10}>
              <span className="display text-2xl leading-none tabular-nums">
                {Math.round((completed.length / Math.max(1, survey.target_responses)) * 100)}%
              </span>
              <span className="text-[10px] text-[var(--muted)]">meta</span>
            </ProgressRing>
            <div className="min-w-[180px] flex-1">
              <p className="text-[13px] font-medium text-[var(--muted)]">Avance del operativo</p>
              <p className="display mt-1 text-3xl leading-none tabular-nums">
                {formatNumber(completed.length)}
                <span className="ml-1.5 text-base text-[var(--muted)]">/ {formatNumber(survey.target_responses)}</span>
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {survey.web_enabled ? `${formatNumber(webCount)} por web · ${formatNumber(completed.length - webCount)} en campo · ` : ""}
                {survey.geography ?? "Sin ámbito"} · cierre {formatDate(survey.ends_at)}
              </p>
              {canManage ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {STATUS_FLOW[survey.status].map((next: SurveyStatus) => {
                    const disabled = next === "activa" && survey.status === "borrador" && blocking > 0;
                    return (
                      <form key={next} action={updateSurveyStatusAction}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="status" value={next} />
                        <button
                          type="submit"
                          disabled={disabled}
                          className={cn(
                            "h-9 rounded-xl px-3.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
                            next === "activa"
                              ? "bg-[var(--success)] text-white shadow-[0_10px_22px_-12px_var(--success)] hover:brightness-110"
                              : next === "cerrada"
                                ? "border border-[var(--border)] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                                : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)]",
                          )}
                        >
                          {transitionLabel(survey.status, next)}
                        </button>
                      </form>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{survey.status === "borrador" ? "Antes de salir a campo" : "Estado del operativo"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-4">
            {checklist.map((c) => (
              <div key={c.label} className="flex items-start gap-2.5">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                ) : c.soft ? (
                  <Circle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">{c.label}</p>
                  <p className="text-xs text-[var(--muted)]">{c.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {questions.length > 0 || completed.length > 0 || assignments.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Preguntas" value={formatNumber(questions.length)} icon={<ClipboardList className="size-4" />} hint={plural(questions.filter((q) => q.logic?.show_if).length, "condicional", "condicionales") + " · " + plural(questions.filter((q) => q.logic?.end_if?.length).length, "filtro", "filtros")} />
          <StatCard label="Equipo de campo" value={formatNumber(assignments.length)} icon={<Users className="size-4" />} tone="accent" hint={`Cuotas: ${formatNumber(totalQuota)}`} />
          <StatCard label="Descartadas por filtro" value={formatNumber(responses.filter((r) => r.status === "descartada").length)} icon={<StopCircle className="size-4" />} tone="warning" hint="No suman a la meta" />
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-5">
        {questions.length === 0 && canManage && survey.status !== "cerrada" ? (
          <Card className="overflow-hidden xl:col-span-3">
            <CardContent className="p-5 sm:p-6">
              <QuestionForm surveyId={id} sources={sources} nextPosition={1} wide />
            </CardContent>
          </Card>
        ) : null}

        <Card className={questions.length === 0 ? "xl:col-span-2" : "xl:col-span-3"}>
          <CardHeader>
            <div>
              <CardTitle>{questions.length === 0 ? "El cuestionario" : `Cuestionario · ${questions.length}`}</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {questions.length === 0
                  ? "Acá se van listando, en el orden de la entrevista."
                  : "El orden es el que ve quien responde. Las ramas se recalculan solas."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {questions.length === 0 ? (
              <>
                <EmptyState
                  icon={<ClipboardList className="size-5" />}
                  title="Todavía no hay preguntas"
                  description="Escribí la primera a la izquierda, o copiá un cuestionario que ya tengas."
                  className="py-10"
                />
                {canManage && survey.status === "borrador" && (otherSurveys ?? []).length ? (
                  <form action={copyQuestionnaireAction} className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                    <input type="hidden" name="survey_id" value={id} />
                    <label className="min-w-[180px] flex-1 text-xs font-medium text-[var(--muted)]">
                      Copiar de otra encuesta
                      <select
                        name="source_id"
                        required
                        className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"
                      >
                        {(otherSurveys ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)] hover:brightness-110">
                      <Copy className="size-4" />
                      Copiar
                    </button>
                  </form>
                ) : null}
              </>
            ) : (
              questions.map((q, i) => {
                const parent = q.logic?.show_if ? byId.get(q.logic.show_if.question_id) : undefined;
                const endIf = q.logic?.end_if ?? [];
                const limit = maxChoices(q);
                const prevSection = i > 0 ? questions[i - 1].section : null;
                return (
                  <div key={q.id}>
                    {q.section && q.section !== prevSection ? (
                      <p className="mt-2 mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-[var(--primary)] uppercase">
                        {q.section}
                        <span className="h-px flex-1 bg-[var(--border)]" />
                      </p>
                    ) : null}
                    <article
                      className={cn(
                        "rounded-2xl border p-4 transition-colors hover:bg-[var(--surface-2)]",
                        parent ? "ml-5 border-dashed border-[color-mix(in_oklab,var(--accent)_45%,var(--border))]" : "border-[var(--border)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                            {typeIcon(q.type)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-[var(--primary)]">P{q.position}</span>
                              <Badge tone="neutral">{QUESTION_TYPE_LABEL[q.type]}</Badge>
                              {!q.is_required ? <Badge tone="neutral">Opcional</Badge> : null}
                              {limit ? <Badge tone="neutral">Hasta {limit}</Badge> : null}
                              {q.type === "escala" ? <Badge tone="neutral">{q.min_value ?? 1} a {q.max_value ?? 10}</Badge> : null}
                              {q.type === "numero" && (q.min_value !== null || q.max_value !== null) ? (
                                <Badge tone="neutral">
                                  {q.min_value ?? "−∞"} a {q.max_value ?? "∞"}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{q.text}</p>
                            {q.help_text ? <p className="mt-1 text-xs text-[var(--muted)]">{q.help_text}</p> : null}
                            {q.options.length ? (
                              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                                {q.options.map((o) => (
                                  <li
                                    key={o.id}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
                                      endIf.includes(o.id)
                                        ? "bg-[var(--warning-soft)] font-medium text-[var(--warning)]"
                                        : "bg-[var(--surface-2)] text-[var(--muted)]",
                                      q.type === "opcion_multiple" && isExclusiveOption(o) && "border border-dashed border-[var(--border)]",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "size-2.5 border border-current opacity-50",
                                        q.type === "opcion_multiple" ? "rounded-[2px]" : "rounded-full",
                                      )}
                                    />
                                    {o.label}
                                  </li>
                                ))}
                              </ul>
                            ) : null}

                            {parent || endIf.length ? (
                              <div className="mt-3 space-y-1.5">
                                {parent ? (
                                  <LogicLine
                                    icon={<GitBranch className="size-3.5" />}
                                    tone="accent"
                                    text={`Solo si P${parent.position} = ${describeCondition(q.logic!.show_if!.values, parent)}`}
                                    form={canManage ? { id: q.id, surveyId: id, which: "show_if" } : null}
                                  />
                                ) : null}
                                {endIf.length ? (
                                  <LogicLine
                                    icon={<StopCircle className="size-3.5" />}
                                    tone="warning"
                                    text={`Termina la entrevista si responde ${describeCondition(endIf, q)}`}
                                    form={canManage ? { id: q.id, surveyId: id, which: "end_if" } : null}
                                  />
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {canManage ? (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <QuestionEditor
                              surveyId={id}
                              question={{
                                id: q.id,
                                text: q.text,
                                help_text: q.help_text,
                                section: q.section,
                                is_required: q.is_required,
                                isFilter: Boolean(endIf.length),
                              }}
                            />
                            {(["up", "down"] as const).map((dir) => (
                              <form key={dir} action={moveQuestionAction}>
                                <input type="hidden" name="id" value={q.id} />
                                <input type="hidden" name="survey_id" value={id} />
                                <input type="hidden" name="direction" value={dir} />
                                <button
                                  type="submit"
                                  disabled={dir === "up" ? i === 0 : i === questions.length - 1}
                                  aria-label={dir === "up" ? "Subir" : "Bajar"}
                                  className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-30"
                                >
                                  {dir === "up" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                                </button>
                              </form>
                            ))}
                            <form action={deleteQuestionAction}>
                              <input type="hidden" name="id" value={q.id} />
                              <input type="hidden" name="survey_id" value={id} />
                              <button
                                type="submit"
                                aria-label="Eliminar pregunta"
                                className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className={questions.length === 0 ? "grid gap-4 xl:col-span-5 xl:grid-cols-2" : "space-y-4 xl:col-span-2"}>
          {questions.length > 0 && canManage && survey.status !== "cerrada" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-5 sm:p-6">
                <QuestionForm surveyId={id} sources={sources} nextPosition={questions.length + 1} />
              </CardContent>
            </Card>
          ) : null}

          {canManage ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <WebChannelCard
                  surveyId={id}
                  surveyStatus={survey.status}
                  enabled={survey.web_enabled}
                  token={survey.public_token}
                  settings={survey.web_settings ?? {}}
                  origin={origin}
                  webResponses={webCount}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Equipo de campo</CardTitle>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <ShieldCheck className="size-3.5" />
                  Lo asigna y gestiona la administración central.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {assignments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                  Todavía no hay encuestadores asignados.{" "}
                  {survey.web_enabled ? "Esta encuesta igual puede recibir respuestas por web." : "Pedile a la administración central que arme el equipo."}
                </p>
              ) : (
                assignments.map((a) => {
                  const done = doneBySurveyor.get(a.surveyor_id) ?? 0;
                  return (
                    <div key={a.id} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">{a.profiles?.full_name ?? "Encuestador"}</p>
                        {a.profiles && !a.profiles.is_active ? <Badge tone="danger">Bloqueado</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{a.zone ?? "Sin zona"}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={done} max={a.quota} tone={done >= a.quota ? "success" : "primary"} className="flex-1" />
                        <span className="text-xs tabular-nums text-[var(--muted)]">
                          {formatNumber(done)}/{formatNumber(a.quota)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              {totalQuota > 0 && totalQuota < survey.target_responses ? (
                <p className="flex items-center gap-1.5 text-xs text-[var(--warning)]">
                  <Target className="size-3.5" />
                  Las cuotas cubren {formatNumber(totalQuota)} de {formatNumber(survey.target_responses)} casos.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function typeIcon(type: QuestionType) {
  const icons: Record<QuestionType, React.ReactNode> = {
    opcion_unica: <CircleDot className="size-4" />,
    opcion_multiple: <CheckSquare className="size-4" />,
    si_no: <ToggleLeft className="size-4" />,
    escala: <Gauge className="size-4" />,
    numero: <Hash className="size-4" />,
    texto_corto: <Type className="size-4" />,
    texto_largo: <AlignLeft className="size-4" />,
    fecha: <Calendar className="size-4" />,
  };
  return icons[type];
}

function LogicLine({
  icon,
  text,
  tone,
  form,
}: {
  icon: React.ReactNode;
  text: string;
  tone: "accent" | "warning";
  form: { id: string; surveyId: string; which: string } | null;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium",
        tone === "accent" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--warning-soft)] text-[var(--warning)]",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">{text}</span>
      {form ? (
        <form action={clearLogicAction}>
          <input type="hidden" name="id" value={form.id} />
          <input type="hidden" name="survey_id" value={form.surveyId} />
          <input type="hidden" name="which" value={form.which} />
          <button type="submit" aria-label="Quitar condición" className="rounded p-0.5 opacity-60 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </form>
      ) : null}
    </div>
  );
}
