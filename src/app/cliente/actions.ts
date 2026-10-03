"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { computeAnalytics, keyFindings, loadSurveyData, type AnalyticsFilters } from "@/lib/analytics";
import { askAboutSurvey, generateSurveyReport, isGeminiConfigured } from "@/lib/ai/gemini";
import { answerLocally } from "@/lib/ai/local-answer";
import { isDemoMode } from "@/lib/demo/mode";
import { buildLocalReport } from "@/lib/demo/report";
import { loadQuestions } from "@/lib/questions";
import { isBranchable, looksExclusive } from "@/lib/survey-logic";
import { WIDGET_MODES, newPublicToken } from "@/lib/web";
import { STATUS_FLOW } from "@/lib/survey-status";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { computeSocial, socialBriefing } from "@/lib/social/analytics";
import { addDays, todayKey } from "@/lib/stats";
import type { SocialPost } from "@/lib/types";
import type {
  QuestionLogic,
  QuestionType,
  QuestionWithOptions,
  ReportKind,
  ServiceLine,
  SurveyStatus,
  WebSettings,
  WidgetMode,
} from "@/lib/types";

export type ActionState = { error?: string | null; ok?: string | null };

const MANAGERS = ["org_admin"] as const;
const QUESTION_TYPES: QuestionType[] = [
  "texto_corto",
  "texto_largo",
  "opcion_unica",
  "opcion_multiple",
  "escala",
  "numero",
  "fecha",
  "si_no",
];
const REPORT_KINDS: ReportKind[] = ["ejecutivo", "tecnico", "comunicacional", "comparativo"];
const NEEDS_OPTIONS: QuestionType[] = ["opcion_unica", "opcion_multiple"];
const SERVICE_LINES: ServiceLine[] = [
  "opinion_publica",
  "tracking",
  "monitor_gestion",
  "inteligencia_territorial",
  "banco_dirigentes",
  "cualitativo",
  "laboratorio_opinion",
  "radar_conversacion",
  "estudios_tematicos",
  "flash",
];

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Carga la encuesta solo si es de la organización de quien pide. RLS ya lo
 * garantiza en la base, pero verificarlo acá da errores claros y cubre el
 * modo demo, que no emula RLS en escrituras.
 */
async function ownedSurvey(supabase: Supabase, surveyId: string, organizationId: string) {
  if (!surveyId) return null;
  const { data } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", surveyId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data;
}

async function completedCount(supabase: Supabase, surveyId: string) {
  const { count } = await supabase
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("survey_id", surveyId)
    .neq("status", "en_curso");
  return count ?? 0;
}

/** Vuelve al detalle con un aviso que la página traduce a mensaje. */
function flash(surveyId: string, code: string): never {
  revalidatePath(`/cliente/encuestas/${surveyId}`);
  redirect(`/cliente/encuestas/${surveyId}?aviso=${code}`);
}

/** Problemas de lógica: condiciones que apuntan a preguntas inexistentes o posteriores. */
function logicProblems(questions: QuestionWithOptions[]) {
  const problems: string[] = [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const q of questions) {
    const cond = q.logic?.show_if;
    if (cond?.question_id) {
      const parent = byId.get(cond.question_id);
      if (!parent) problems.push(`P${q.position} depende de una pregunta que ya no existe.`);
      else if (parent.position >= q.position) problems.push(`P${q.position} depende de P${parent.position}, que viene después.`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization, profile } = await requireOrganization([...MANAGERS]);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const serviceLine = String(formData.get("service_line") ?? "opinion_publica") as ServiceLine;
  const color = String(formData.get("color") ?? "").trim() || null;

  if (name.length < 3) return { error: "El nombre del proyecto es demasiado corto." };
  if (!SERVICE_LINES.includes(serviceLine)) return { error: "Línea de servicio inválida." };
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
    return { error: "El color tiene que estar en formato #RRGGBB." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    organization_id: organization.id,
    name,
    description,
    service_line: serviceLine,
    color,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo crear el proyecto: ${error.message}` };

  revalidatePath("/cliente/proyectos");
  revalidatePath("/cliente/encuestas/nueva");
  redirect("/cliente/proyectos");
}

// ---------------------------------------------------------------------------
// Encuestas
// ---------------------------------------------------------------------------

export async function createSurveyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization, profile } = await requireOrganization([...MANAGERS]);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const geography = String(formData.get("geography") ?? "").trim() || null;
  const methodology = String(formData.get("methodology") ?? "").trim() || null;
  const target = Number(formData.get("target_responses") ?? 0);
  const startsAt = String(formData.get("starts_at") ?? "") || null;
  const endsAt = String(formData.get("ends_at") ?? "") || null;
  const copyFrom = String(formData.get("copy_from") ?? "") || null;
  const projectId = String(formData.get("project_id") ?? "") || null;
  const web = formData.get("web_enabled") === "on";

  if (title.length < 5) return { error: "El título es demasiado corto." };
  if (title.length > 160) return { error: "El título es demasiado largo (máximo 160 caracteres)." };
  if (!Number.isInteger(target) || target < 1 || target > 100000) {
    return { error: "La meta de casos tiene que ser un número entero entre 1 y 100.000." };
  }
  if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
    return { error: "La fecha de cierre no puede ser anterior a la de inicio." };
  }

  const supabase = await createClient();
  if (copyFrom && !(await ownedSurvey(supabase, copyFrom, organization.id))) {
    return { error: "La encuesta de origen para copiar el cuestionario no existe." };
  }
  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("organization_id", organization.id)
      .maybeSingle();
    if (!project) return { error: "El proyecto elegido no existe." };
  }

  const { data, error } = await supabase
    .from("surveys")
    .insert({
      organization_id: organization.id,
      project_id: projectId,
      title,
      description,
      geography,
      methodology,
      target_responses: target,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(`${endsAt}T23:59:00`).toISOString() : null,
      created_by: profile.id,
      status: "borrador",
      web_enabled: web,
      public_token: web ? newPublicToken(title) : null,
      web_settings: {},
    })
    .select("id")
    .single();

  if (error || !data) return { error: `No se pudo crear la encuesta: ${error?.message}` };

  if (copyFrom) {
    const copied = await copyQuestionnaire(supabase, copyFrom, data.id);
    if (!copied.ok) return { error: `La encuesta se creó, pero no se pudo copiar el cuestionario: ${copied.error}` };
  }

  revalidatePath("/cliente/encuestas");
  redirect(`/cliente/encuestas/${data.id}${copyFrom ? "?aviso=copiado" : ""}`);
}

export async function updateSurveyStatusAction(formData: FormData) {
  const { organization } = await requireOrganization([...MANAGERS]);

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as SurveyStatus;
  const supabase = await createClient();
  const survey = await ownedSurvey(supabase, id, organization.id);
  if (!survey) return;

  if (!STATUS_FLOW[survey.status as SurveyStatus]?.includes(status)) flash(id, "transicion");

  if (status === "activa") {
    const questions = await loadQuestions(supabase, id);
    if (!questions.length) flash(id, "sin-preguntas");
    if (logicProblems(questions).length) flash(id, "logica-rota");
    if (questions.some((q) => NEEDS_OPTIONS.includes(q.type) && q.options.length < 2)) flash(id, "sin-opciones");
  }

  await supabase
    .from("surveys")
    .update({
      status,
      ...(status === "activa" && !survey.starts_at ? { starts_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
  revalidatePath("/cliente/encuestas");
  revalidatePath("/cliente");
  revalidatePath("/campo");
  flash(id, status === "activa" ? (survey.status === "borrador" ? "en-campo" : "reactivada") : status);
}

export async function duplicateSurveyAction(formData: FormData) {
  const { organization, profile } = await requireOrganization([...MANAGERS]);
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const source = await ownedSurvey(supabase, id, organization.id);
  if (!source) return;

  const { data } = await supabase
    .from("surveys")
    .insert({
      organization_id: organization.id,
      project_id: source.project_id,
      title: `${source.title} (nueva ola)`.slice(0, 160),
      description: source.description,
      geography: source.geography,
      methodology: source.methodology,
      target_responses: source.target_responses,
      status: "borrador",
      created_by: profile.id,
      web_enabled: source.web_enabled,
      public_token: source.web_enabled ? newPublicToken(source.title) : null,
      web_settings: source.web_settings ?? {},
    })
    .select("id")
    .single();
  if (!data) flash(id, "error");

  await copyQuestionnaire(supabase, id, data.id);
  revalidatePath("/cliente/encuestas");
  redirect(`/cliente/encuestas/${data.id}?aviso=duplicada`);
}

/**
 * Copia preguntas, opciones y lógica. Los ids cambian, así que los saltos se
 * remapean: una condición de la ola anterior apunta a la pregunta equivalente
 * de la nueva, no a la vieja.
 */
async function copyQuestionnaire(
  supabase: Supabase,
  sourceId: string,
  targetId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const questions = await loadQuestions(supabase, sourceId);
  const questionMap = new Map<string, string>();
  const optionMap = new Map<string, string>();

  for (const q of questions) {
    const { data: created, error } = await supabase
      .from("questions")
      .insert({
        survey_id: targetId,
        position: q.position,
        type: q.type,
        text: q.text,
        help_text: q.help_text,
        is_required: q.is_required,
        section: q.section,
        min_value: q.min_value,
        max_value: q.max_value,
        logic: null,
      })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? "sin detalle" };
    questionMap.set(q.id, created.id);

    for (const o of q.options) {
      const { data: opt, error: optError } = await supabase
        .from("question_options")
        .insert({ question_id: created.id, position: o.position, label: o.label, value: o.value, is_exclusive: o.is_exclusive })
        .select("id")
        .single();
      if (optError || !opt) return { ok: false, error: optError?.message ?? "sin detalle" };
      optionMap.set(o.id, opt.id);
    }
  }

  const remap = (v: string) => optionMap.get(v) ?? v; // "si"/"no" quedan igual
  for (const q of questions) {
    if (!q.logic) continue;
    const logic: QuestionLogic = {};
    if (q.logic.show_if?.question_id && questionMap.has(q.logic.show_if.question_id)) {
      logic.show_if = {
        question_id: questionMap.get(q.logic.show_if.question_id)!,
        values: q.logic.show_if.values.map(remap),
      };
    }
    if (q.logic.end_if?.length) logic.end_if = q.logic.end_if.map(remap);
    await supabase.from("questions").update({ logic }).eq("id", questionMap.get(q.id)!);
  }

  return { ok: true, count: questions.length };
}

export async function copyQuestionnaireAction(formData: FormData) {
  const { organization } = await requireOrganization([...MANAGERS]);
  const targetId = String(formData.get("survey_id") ?? "");
  const sourceId = String(formData.get("source_id") ?? "");
  const supabase = await createClient();

  const [target, source] = await Promise.all([
    ownedSurvey(supabase, targetId, organization.id),
    ownedSurvey(supabase, sourceId, organization.id),
  ]);
  if (!target || !source) return;
  if (target.status !== "borrador") flash(targetId, "transicion");
  if ((await loadQuestions(supabase, targetId)).length) flash(targetId, "no-vacia");

  const result = await copyQuestionnaire(supabase, sourceId, targetId);
  flash(targetId, result.ok ? "copiado" : "error");
}

// ---------------------------------------------------------------------------
// Preguntas
// ---------------------------------------------------------------------------

function readNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export async function addQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization } = await requireOrganization([...MANAGERS]);

  const surveyId = String(formData.get("survey_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const type = String(formData.get("type") ?? "opcion_unica") as QuestionType;
  const helpText = String(formData.get("help_text") ?? "").trim() || null;
  const section = String(formData.get("section") ?? "").trim() || null;
  const isRequired = formData.get("is_required") === "on";
  const rawOptions = String(formData.get("options") ?? "");
  const showIfQuestion = String(formData.get("show_if_question") ?? "") || null;
  const showIfValues = formData.getAll("show_if_values").map(String).filter(Boolean);
  const endIfValues = formData.getAll("end_if_values").map(String).filter(Boolean);

  if (text.length < 3) return { error: "El enunciado de la pregunta es demasiado corto." };
  if (text.length > 500) return { error: "El enunciado es demasiado largo (máximo 500 caracteres)." };
  if (!QUESTION_TYPES.includes(type)) return { error: "Tipo de pregunta inválido." };

  const options = [...new Set(rawOptions.split("\n").map((o) => o.trim()).filter(Boolean))];
  if (NEEDS_OPTIONS.includes(type) && options.length < 2) {
    return { error: "Las preguntas de opción necesitan al menos dos opciones distintas, una por línea." };
  }
  if (options.length > 30) return { error: "Demasiadas opciones (máximo 30)." };
  if (options.some((o) => o.length > 160)) return { error: "Hay opciones de más de 160 caracteres." };

  // --- rangos y topes -------------------------------------------------------
  let minValue: number | null = null;
  let maxValue: number | null = null;
  if (type === "escala") {
    minValue = readNumber(formData, "min_value") ?? 1;
    maxValue = readNumber(formData, "max_value") ?? 10;
    if (!Number.isInteger(minValue) || !Number.isInteger(maxValue) || maxValue - minValue < 1 || maxValue - minValue > 10) {
      return { error: "La escala necesita extremos enteros y entre 2 y 11 puntos (por ejemplo, 0 a 10 o 1 a 5)." };
    }
  } else if (type === "numero") {
    minValue = readNumber(formData, "min_value");
    maxValue = readNumber(formData, "max_value");
    if (Number.isNaN(minValue) || Number.isNaN(maxValue)) return { error: "El rango numérico no es válido." };
    if (minValue !== null && maxValue !== null && maxValue <= minValue) {
      return { error: "El máximo tiene que ser mayor que el mínimo." };
    }
  } else if (type === "opcion_multiple") {
    maxValue = readNumber(formData, "max_choices");
    if (maxValue !== null && (!Number.isInteger(maxValue) || maxValue < 1 || maxValue >= options.length)) {
      return { error: `El tope de opciones tiene que ser un entero entre 1 y ${options.length - 1}, o quedar vacío.` };
    }
  }

  const supabase = await createClient();
  const survey = await ownedSurvey(supabase, surveyId, organization.id);
  if (!survey) return { error: "No se encontró la encuesta." };
  if (survey.status === "cerrada") return { error: "La encuesta está cerrada: reabrila para modificar el cuestionario." };

  const existing = await loadQuestions(supabase, surveyId);
  const position = (existing.at(-1)?.position ?? 0) + 1;

  // --- lógica ---------------------------------------------------------------
  const logic: QuestionLogic = {};
  if (showIfQuestion) {
    const parent = existing.find((q) => q.id === showIfQuestion);
    if (!parent || !isBranchable(parent)) return { error: "La condición tiene que depender de una pregunta de opción o Sí/No." };
    const valid = parent.type === "si_no" ? ["si", "no"] : parent.options.map((o) => o.id);
    const values = showIfValues.filter((v) => valid.includes(v));
    if (!values.length) return { error: "Elegí al menos una respuesta que active la condición." };
    if (values.length === valid.length) return { error: "La condición incluye todas las respuestas posibles: no filtra nada." };
    logic.show_if = { question_id: parent.id, values };
  }
  if (endIfValues.length) {
    if (type === "si_no") {
      const values = endIfValues.filter((v) => v === "si" || v === "no");
      if (values.length === 2) return { error: "El filtro no puede terminar la entrevista con cualquier respuesta." };
      if (values.length) logic.end_if = values;
    } else if (type === "opcion_unica") {
      // Las opciones todavía no tienen id: el formulario manda su índice (o1, o2…).
      const idx = endIfValues.map((v) => Number(v.replace(/^o/, ""))).filter((n) => n >= 1 && n <= options.length);
      if (idx.length >= options.length) return { error: "El filtro no puede terminar la entrevista con cualquier respuesta." };
      if (idx.length) logic.end_if = idx.map((n) => `__o${n}`);
    }
  }

  const { data: question, error } = await supabase
    .from("questions")
    .insert({
      survey_id: surveyId,
      position,
      type,
      text,
      help_text: helpText,
      section,
      is_required: logic.end_if ? true : isRequired,
      min_value: minValue,
      max_value: maxValue,
      logic: Object.keys(logic).length ? logic : null,
    })
    .select("id")
    .single();

  if (error || !question) return { error: `No se pudo agregar la pregunta: ${error?.message}` };

  if (options.length) {
    const ids: string[] = [];
    for (const [i, label] of options.entries()) {
      const { data: opt, error: optError } = await supabase
        .from("question_options")
        .insert({ question_id: question.id, position: i + 1, label, is_exclusive: type === "opcion_multiple" && looksExclusive(label) })
        .select("id")
        .single();
      if (optError || !opt) return { error: `La pregunta se creó pero fallaron las opciones: ${optError?.message}` };
      ids.push(opt.id);
    }
    if (logic.end_if?.some((v) => v.startsWith("__o"))) {
      const endIf = logic.end_if.map((v) => (v.startsWith("__o") ? ids[Number(v.slice(3)) - 1] : v));
      await supabase.from("questions").update({ logic: { ...logic, end_if: endIf } }).eq("id", question.id);
    }
  }

  revalidatePath(`/cliente/encuestas/${surveyId}`);
  const answered = await completedCount(supabase, surveyId);
  return {
    ok: answered
      ? `P${position} agregada. Las ${answered} entrevistas ya cargadas no la tienen: su base va a ser menor.`
      : `P${position} agregada.`,
  };
}

export async function updateQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization } = await requireOrganization([...MANAGERS]);
  const id = String(formData.get("id") ?? "");
  const surveyId = String(formData.get("survey_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const helpText = String(formData.get("help_text") ?? "").trim() || null;
  const section = String(formData.get("section") ?? "").trim() || null;
  const isRequired = formData.get("is_required") === "on";

  if (text.length < 3 || text.length > 500) return { error: "El enunciado tiene que tener entre 3 y 500 caracteres." };

  const supabase = await createClient();
  if (!(await ownedSurvey(supabase, surveyId, organization.id))) return { error: "No se encontró la encuesta." };
  const { data: question } = await supabase.from("questions").select("id, logic").eq("id", id).eq("survey_id", surveyId).maybeSingle();
  if (!question) return { error: "No se encontró la pregunta." };

  await supabase
    .from("questions")
    .update({
      text,
      help_text: helpText,
      section,
      // Una pregunta filtro siempre es obligatoria: si se saltea, el filtro no filtra.
      is_required: (question.logic as QuestionLogic | null)?.end_if?.length ? true : isRequired,
    })
    .eq("id", id);

  revalidatePath(`/cliente/encuestas/${surveyId}`);
  return { ok: "Cambios guardados." };
}

export async function clearLogicAction(formData: FormData) {
  const { organization } = await requireOrganization([...MANAGERS]);
  const id = String(formData.get("id") ?? "");
  const surveyId = String(formData.get("survey_id") ?? "");
  const which = String(formData.get("which") ?? "");
  const supabase = await createClient();
  if (!(await ownedSurvey(supabase, surveyId, organization.id))) return;

  const { data: question } = await supabase.from("questions").select("logic").eq("id", id).eq("survey_id", surveyId).maybeSingle();
  if (!question) return;
  const logic = { ...((question.logic as QuestionLogic | null) ?? {}) };
  if (which === "show_if") delete logic.show_if;
  if (which === "end_if") delete logic.end_if;
  await supabase.from("questions").update({ logic: Object.keys(logic).length ? logic : null }).eq("id", id);
  flash(surveyId, "logica-quitada");
}

export async function deleteQuestionAction(formData: FormData) {
  const { organization } = await requireOrganization([...MANAGERS]);
  const id = String(formData.get("id") ?? "");
  const surveyId = String(formData.get("survey_id") ?? "");
  const supabase = await createClient();
  if (!(await ownedSurvey(supabase, surveyId, organization.id))) return;

  // Borrar una pregunta con respuestas borra datos de campo en cascada.
  const { count } = await supabase.from("answers").select("id", { count: "exact", head: true }).eq("question_id", id);
  if (count) flash(surveyId, "con-respuestas");

  const questions = await loadQuestions(supabase, surveyId);
  if (questions.some((q) => q.logic?.show_if?.question_id === id)) flash(surveyId, "dependencia");

  await supabase.from("questions").delete().eq("id", id);

  // Compactar posiciones para que el cuestionario siga numerado 1..n.
  const rest = questions.filter((q) => q.id !== id);
  for (const [i, q] of rest.entries()) {
    if (q.position !== i + 1) await supabase.from("questions").update({ position: i + 1 }).eq("id", q.id);
  }
  flash(surveyId, "borrada");
}

export async function moveQuestionAction(formData: FormData) {
  const { organization } = await requireOrganization([...MANAGERS]);
  const id = String(formData.get("id") ?? "");
  const surveyId = String(formData.get("survey_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!["up", "down"].includes(direction)) return;

  const supabase = await createClient();
  if (!(await ownedSurvey(supabase, surveyId, organization.id))) return;
  const questions = await loadQuestions(supabase, surveyId);

  const index = questions.findIndex((q) => q.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= questions.length) return;

  const a = questions[index];
  const b = questions[swapWith];

  // Si una de las dos depende de la otra, el intercambio rompería el salto.
  const reordered = questions.map((q) =>
    q.id === a.id ? { ...q, position: b.position } : q.id === b.id ? { ...q, position: a.position } : q,
  );
  if (logicProblems(reordered).length) flash(surveyId, "orden-logica");

  await supabase.from("questions").update({ position: -1 }).eq("id", a.id);
  await supabase.from("questions").update({ position: a.position }).eq("id", b.id);
  await supabase.from("questions").update({ position: b.position }).eq("id", a.id);

  revalidatePath(`/cliente/encuestas/${surveyId}`);
}

// ---------------------------------------------------------------------------
// Canal web
// ---------------------------------------------------------------------------

export async function updateWebChannelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization } = await requireOrganization([...MANAGERS]);
  const surveyId = String(formData.get("survey_id") ?? "");
  const supabase = await createClient();
  const survey = await ownedSurvey(supabase, surveyId, organization.id);
  if (!survey) return { error: "No se encontró la encuesta." };

  const enabled = formData.get("web_enabled") === "on";
  const text = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max) || null;
  const accent = String(formData.get("accent") ?? "").trim();
  const mode = String(formData.get("mode") ?? "flotante") as WidgetMode;
  const delay = Number(formData.get("popup_delay") ?? 6);

  if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) return { error: "El color tiene que estar en formato #RRGGBB." };
  if (!WIDGET_MODES.includes(mode)) return { error: "Modo de widget inválido." };
  if (!Number.isFinite(delay) || delay < 0 || delay > 120) return { error: "La demora tiene que estar entre 0 y 120 segundos." };

  const settings: WebSettings = {
    accent: accent || null,
    welcome_title: text("welcome_title", 120),
    welcome_text: text("welcome_text", 400),
    thanks_title: text("thanks_title", 120),
    thanks_text: text("thanks_text", 400),
    button_label: text("button_label", 40),
    mode,
    one_per_device: formData.get("one_per_device") === "on",
    popup_delay: Math.round(delay),
  };

  const { error } = await supabase
    .from("surveys")
    .update({
      web_enabled: enabled,
      web_settings: settings,
      public_token: survey.public_token ?? (enabled ? newPublicToken(survey.title) : null),
    })
    .eq("id", surveyId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/cliente/encuestas/${surveyId}`);
  return {
    ok: enabled
      ? survey.status === "activa"
        ? "Canal web activo: la encuesta ya se puede responder desde el link o el widget."
        : "Canal web configurado. Va a recibir respuestas cuando la encuesta salga a campo."
      : "Canal web desactivado.",
  };
}

export async function regenerateTokenAction(formData: FormData) {
  const { organization } = await requireOrganization([...MANAGERS]);
  const surveyId = String(formData.get("survey_id") ?? "");
  const supabase = await createClient();
  const survey = await ownedSurvey(supabase, surveyId, organization.id);
  if (!survey) return;
  // Cambiar el token invalida los links y widgets ya publicados: se usa si se filtró.
  await supabase.from("surveys").update({ public_token: newPublicToken(survey.title) }).eq("id", surveyId);
  flash(surveyId, "token-nuevo");
}

// ---------------------------------------------------------------------------
// Banco de dirigentes
// ---------------------------------------------------------------------------

async function ownedDirigente(supabase: Supabase, dirigenteId: string, organizationId: string) {
  if (!dirigenteId) return null;
  const { data } = await supabase
    .from("dirigentes")
    .select("*")
    .eq("id", dirigenteId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data;
}

export async function createDirigenteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization, profile } = await requireOrganization([...MANAGERS]);

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() || null;
  const affiliation = String(formData.get("affiliation") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (name.length < 3) return { error: "Ingresá el nombre del dirigente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dirigentes")
    .insert({
      organization_id: organization.id,
      name,
      role,
      affiliation,
      notes,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: `No se pudo crear la ficha: ${error?.message}` };

  revalidatePath("/cliente/dirigentes");
  redirect(`/cliente/dirigentes/${data.id}`);
}

export async function createMedicionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization, profile } = await requireOrganization([...MANAGERS]);

  const dirigenteId = String(formData.get("dirigente_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "") || null;
  const conocimiento = readNumber(formData, "conocimiento");
  const imagenPositiva = readNumber(formData, "imagen_positiva");
  const imagenNegativa = readNumber(formData, "imagen_negativa");
  const segmento = String(formData.get("segmento") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const measuredAt = String(formData.get("measured_at") ?? "") || null;

  for (const [label, v] of [
    ["Conocimiento", conocimiento],
    ["Imagen positiva", imagenPositiva],
    ["Imagen negativa", imagenNegativa],
  ] as const) {
    if (v !== null && (Number.isNaN(v) || v < 0 || v > 100)) {
      return { error: `${label} tiene que ser un porcentaje entre 0 y 100.` };
    }
  }

  const supabase = await createClient();
  const dirigente = await ownedDirigente(supabase, dirigenteId, organization.id);
  if (!dirigente) return { error: "No se encontró el dirigente." };

  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("organization_id", organization.id)
      .maybeSingle();
    if (!project) return { error: "El proyecto elegido no existe." };
  }

  const { error } = await supabase.from("dirigente_mediciones").insert({
    dirigente_id: dirigenteId,
    project_id: projectId,
    conocimiento,
    imagen_positiva: imagenPositiva,
    imagen_negativa: imagenNegativa,
    segmento,
    notes,
    measured_at: measuredAt ? new Date(measuredAt).toISOString() : new Date().toISOString(),
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo cargar la medición: ${error.message}` };

  revalidatePath(`/cliente/dirigentes/${dirigenteId}`);
  return { ok: "Medición cargada." };
}

// ---------------------------------------------------------------------------
// Informes con IA
// ---------------------------------------------------------------------------

export async function generateReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization, profile } = await requireOrganization([...MANAGERS]);

  // Sin clave, en modo demo caemos en el redactor local para que el recorrido
  // no quede cortado; fuera de demo es un error de configuración.
  const useLocalWriter = !isGeminiConfigured() && isDemoMode();

  if (!isGeminiConfigured() && !useLocalWriter) {
    return {
      error:
        "Falta GEMINI_API_KEY en .env.local. Generá una clave en aistudio.google.com/apikey para habilitar los informes.",
    };
  }

  const surveyId = String(formData.get("survey_id") ?? "");
  const kind = String(formData.get("kind") ?? "ejecutivo") as ReportKind;
  const audience = String(formData.get("audience") ?? "").trim().slice(0, 200) || null;
  const focus = String(formData.get("focus") ?? "").trim().slice(0, 600) || null;

  if (!surveyId) return { error: "Elegí una encuesta." };
  if (!REPORT_KINDS.includes(kind)) return { error: "Tipo de informe inválido." };

  const supabase = await createClient();
  const data = await loadSurveyData(supabase, surveyId);
  if (!data || data.survey.organization_id !== organization.id) {
    return { error: "No se encontró la encuesta." };
  }
  const analytics = computeAnalytics(data);
  const findings = keyFindings(data);
  if (analytics.totals.completed < 10) {
    return {
      error: `La encuesta tiene ${analytics.totals.completed} casos completados. Se necesitan al menos 10 para que el análisis tenga sentido.`,
    };
  }

  // Dejamos la fila creada antes de llamar al modelo: si algo falla, el error
  // queda registrado y visible en el listado.
  const { data: report, error: insertError } = await supabase
    .from("ai_reports")
    .insert({
      survey_id: surveyId,
      organization_id: organization.id,
      title: `Informe de ${analytics.survey.title}`,
      kind,
      status: "generando",
      audience,
      focus,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (insertError || !report) {
    return { error: `No se pudo iniciar el informe: ${insertError?.message}` };
  }

  // Humor en redes de los últimos 30 días, si la organización lo mide: da contexto de agenda.
  const today = todayKey();
  const socialPosts = await fetchAll<SocialPost>((from, to) =>
    supabase
      .from("social_posts")
      .select("*")
      .eq("organization_id", organization.id)
      .gte("published_at", new Date(`${addDays(today, -60)}T00:00:00-03:00`).toISOString())
      .order("id")
      .range(from, to),
  );
  const social = socialPosts.length >= 20 ? computeSocial(socialPosts, { days: 30 }, today) : null;

  try {
    const generated = useLocalWriter
      ? buildLocalReport({ analytics, findings, social, organizationName: organization.name, kind, audience, focus })
      : await generateSurveyReport({
          analytics,
          findings,
          socialSummary: social ? socialBriefing(social) : undefined,
          organizationName: organization.name,
          kind,
          audience,
          focus,
        });

    await supabase
      .from("ai_reports")
      .update({
        title: generated.title,
        content: generated.markdown,
        highlights: generated.highlights,
        model: generated.model,
        status: "listo",
      })
      .eq("id", report.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido del modelo.";
    await supabase.from("ai_reports").update({ status: "error", error_message: message }).eq("id", report.id);
    return { error: `El modelo no pudo generar el informe: ${message}` };
  }

  revalidatePath("/cliente/informes");
  redirect(`/cliente/informes/${report.id}`);
}

export type AskResult = { ok: boolean; answer?: string; source?: string; error?: string };

/**
 * "Preguntale a los datos": consulta libre sobre los resultados, con los
 * mismos filtros que el tablero. Lectura, así que la puede usar el analista.
 */
export async function askSurveyAction(payload: {
  surveyId: string;
  question: string;
  filters?: AnalyticsFilters;
}): Promise<AskResult> {
  const { organization } = await requireOrganization(["org_admin", "org_analyst"]);
  const question = payload.question?.trim() ?? "";
  if (question.length < 4) return { ok: false, error: "Escribí una pregunta más completa." };
  if (question.length > 400) return { ok: false, error: "La pregunta es demasiado larga (máximo 400 caracteres)." };

  const supabase = await createClient();
  const data = await loadSurveyData(supabase, payload.surveyId);
  if (!data || data.survey.organization_id !== organization.id) {
    return { ok: false, error: "No se encontró la encuesta." };
  }

  const analytics = computeAnalytics(data, payload.filters ?? {});
  if (analytics.totals.completed === 0) {
    return { ok: false, error: "No hay casos completados con los filtros actuales." };
  }
  const findings = keyFindings(data, payload.filters ?? {});

  if (!isGeminiConfigured()) {
    return { ok: true, answer: answerLocally(analytics, findings, question), source: "Lectura local" };
  }

  try {
    const { answer, model } = await askAboutSurvey({ analytics, findings, question });
    return { ok: true, answer, source: model };
  } catch (e) {
    // Si el modelo falla, la lectura local sigue siendo mejor que un error seco.
    const reason = e instanceof Error ? e.message : "error del modelo";
    return {
      ok: true,
      answer: `${answerLocally(analytics, findings, question)}\n\n_El modelo no respondió (${reason.slice(0, 120)})._`,
      source: "Lectura local",
    };
  }
}

export async function deleteReportAction(formData: FormData) {
  const { organization } = await requireOrganization([...MANAGERS]);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("ai_reports").delete().eq("id", id).eq("organization_id", organization.id);
  revalidatePath("/cliente/informes");
}
