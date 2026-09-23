import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PauseCircle } from "lucide-react";
import { SurveyRunner } from "./survey-runner";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { loadQuestions } from "@/lib/questions";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { dayKey, todayKey } from "@/lib/stats";
import { SURVEY_STATUS_LABEL, type Survey } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("surveys").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Entrevista" };
}

export default async function CargarEntrevistaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireRole(["surveyor"]);
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("survey_assignments")
    .select("*, surveys(*)")
    .eq("survey_id", id)
    .eq("surveyor_id", profile.id)
    .maybeSingle();

  if (!assignment?.surveys) notFound();
  const survey = assignment.surveys as Survey;

  if (survey.status !== "activa") {
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center animate-rise">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--warning-soft)] text-[var(--warning)]">
          <PauseCircle className="size-6" />
        </span>
        <div>
          <h1 className="display text-3xl text-[var(--foreground)]">{survey.title}</h1>
          <p className="mt-1 text-sm font-medium text-[var(--warning)]">{SURVEY_STATUS_LABEL[survey.status]}</p>
        </div>
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          Esta encuesta no está en campo en este momento, así que no se pueden cargar entrevistas. Consultá con la
          coordinación del operativo.
        </p>
        <Link
          href="/campo"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" />
          Volver a mis asignaciones
        </Link>
      </div>
    );
  }

  const [questions, mine] = await Promise.all([
    loadQuestions(supabase, id),
    fetchAll<{ status: string; zone: string | null; submitted_at: string | null }>((from, to) =>
      supabase
        .from("responses")
        .select("status, zone, submitted_at")
        .eq("survey_id", id)
        .eq("surveyor_id", profile.id)
        .order("submitted_at", { ascending: false })
        .range(from, to),
    ),
  ]);

  const completed = mine.filter((r) => r.status === "completada");
  const today = todayKey();

  // Zonas sugeridas: las que ya cargó, primero las más recientes.
  const zones = [...new Set(mine.map((r) => r.zone?.trim()).filter((z): z is string => Boolean(z)))].slice(0, 12);

  return (
    <SurveyRunner
      surveyId={id}
      surveyTitle={survey.title}
      surveyorId={profile.id}
      questions={questions}
      defaultZone={zones[0] ?? assignment.zone}
      zones={zones}
      done={completed.length}
      doneToday={completed.filter((r) => r.submitted_at && dayKey(r.submitted_at) === today).length}
      quota={assignment.quota}
    />
  );
}
