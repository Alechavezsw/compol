"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, History, MapPin, RotateCcw, Trash2, UserX } from "lucide-react";
import { submitResponseAction } from "../../actions";
import { useInterview, type Draft } from "@/components/interview/use-interview";
import { InterviewView } from "@/components/interview/interview-view";
import { ProgressRing } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ZoneSearch } from "@/components/zone-search";
import { enqueueInterview, readQueue, removeQueued } from "@/lib/campo/offline-queue";
import { foldZone } from "@/lib/san-juan-zones";
import type { QuestionWithOptions } from "@/lib/types";
import { cn } from "@/lib/utils";

type Extra = { zone: string };
type Outcome = { status: "completada" | "descartada"; queued?: boolean } | null;

function ago(ms: number) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

export function SurveyRunner({
  surveyId,
  surveyTitle,
  surveyorId,
  questions,
  defaultZone,
  zones,
  zoneQuotas = [],
  done,
  doneToday,
  quota,
}: {
  surveyId: string;
  surveyTitle: string;
  surveyorId: string;
  questions: QuestionWithOptions[];
  defaultZone: string | null;
  zones: string[];
  zoneQuotas?: { zone: string; quota: number }[];
  done: number;
  doneToday: number;
  quota: number;
}) {
  const interview = useInterview<Extra>({
    questions,
    storageKey: `consulta:borrador:${surveyId}:${surveyorId}`,
  });
  const [zone, setZone] = useState(defaultZone ?? "");
  const [saved, setSaved] = useState(done);
  const [today, setToday] = useState(doneToday);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [draft, setDraft] = useState<Draft<Extra> | null>(null);
  const [pending, startTransition] = useTransition();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [queued, setQueued] = useState(0);

  // El borrador vive en localStorage: solo se puede leer después de montar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de almacenamiento del navegador
    setDraft(interview.pendingDraft());
    setQueued(readQueue(surveyorId).length);
  }, [interview.pendingDraft, surveyorId]);

  useEffect(() => {
    async function flush() {
      for (const item of readQueue(surveyorId)) {
        const result = await submitResponseAction({
          surveyId: item.surveyId,
          zone: item.zone,
          durationSeconds: item.durationSeconds,
          answers: item.answers,
          latitude: item.latitude,
          longitude: item.longitude,
        });
        if (!result.ok) break;
        removeQueued(surveyorId, item.id);
        if (result.status === "completada") {
          setSaved((n) => n + 1);
          setToday((n) => n + 1);
        }
      }
      setQueued(readQueue(surveyorId).length);
    }
    const onOnline = () => {
      void flush();
    };
    window.addEventListener("online", onOnline);
    if (navigator.onLine) void flush();
    return () => window.removeEventListener("online", onOnline);
  }, [surveyorId]);

  const total = questions.length;
  const quotaDone = saved >= quota;

  function requestFix() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8000 },
    );
  }

  function begin() {
    setOutcome(null);
    setDraft(null);
    interview.clearDraft();
    requestFix();
    interview.start({ zone: zone.trim() });
  }

  function resume(d: Draft<Extra>) {
    setZone(d.extra?.zone ?? zone);
    setDraft(null);
    requestFix();
    interview.restore(d);
  }

  const zoneQuota = zoneQuotas.find((q) => foldZone(q.zone) === foldZone(zone));

  function submit() {
    const { answers, errors, ended, durationSeconds } = interview.collect();
    if (errors.length) {
      interview.goTo(errors[0].questionId);
      interview.setError(errors[0].message);
      return;
    }

    const payload = {
      surveyId,
      zone: interview.extra?.zone || zone.trim() || null,
      durationSeconds,
      answers,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    };

    startTransition(async () => {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (!offline) {
        const result = await submitResponseAction(payload);
        if (result.ok) {
          interview.stop();
          if (result.status === "completada") {
            setSaved((n) => n + 1);
            setToday((n) => n + 1);
          }
          setOutcome({ status: result.status ?? (ended ? "descartada" : "completada") });
          return;
        }
      }

      enqueueInterview(surveyorId, payload);
      interview.stop();
      interview.clearDraft();
      setQueued((n) => n + 1);
      setOutcome({ status: ended ? "descartada" : "completada", queued: true });
    });
  }

  // ------------------------------------------------------------------ cierre
  if (outcome) {
    const completed = outcome.status === "completada";
    return (
      <div className="mx-auto max-w-lg animate-rise">
        <div className="relative overflow-hidden rounded-[26px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] p-8 text-center shadow-[var(--shadow-card)]">
          <div className={cn("orb -top-16 left-1/2 size-56 -translate-x-1/2 opacity-20", completed ? "bg-[var(--success)]" : "bg-[var(--warning)]")} />
          <div className="relative">
            {completed ? (
              <ProgressRing value={saved} max={quota} size={132} stroke={12} tone={quotaDone ? "success" : "primary"} className="mx-auto">
                <CheckCircle2 className="size-6 text-[var(--success)]" />
                <span className="display mt-1 text-2xl leading-none tabular-nums">{saved}</span>
                <span className="text-[10px] text-[var(--muted)]">de {quota}</span>
              </ProgressRing>
            ) : (
              <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[var(--warning-soft)] text-[var(--warning)]">
                <UserX className="size-7" />
              </span>
            )}
            <h2 className="display mt-5 text-3xl text-[var(--foreground)]">
              {outcome.queued
                ? "Quedó en cola"
                : completed
                  ? quotaDone
                    ? "¡Cuota cumplida!"
                    : "Entrevista guardada"
                  : "Contacto registrado"}
            </h2>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {outcome.queued
                ? "No había señal. Se sube sola cuando el teléfono vuelva a conectarse."
                : completed
                  ? quotaDone
                    ? `Llegaste a los ${quota} casos asignados. Consultá con la coordinación antes de seguir cargando.`
                    : `Te faltan ${quota - saved} casos · hoy llevás ${today}.`
                  : "Quedó como descartada por filtro. No suma a tu cuota."}
            </p>

            <Button size="lg" className="mt-7 w-full" onClick={begin}>
              <RotateCcw />
              Nueva entrevista
            </Button>
            <Link
              href="/campo"
              className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="size-4" />
              Volver a mis asignaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------- inicio
  if (!interview.active) {
    return (
      <div className="mx-auto max-w-lg space-y-5 animate-rise">
        <div className="relative overflow-hidden rounded-[26px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] p-6 shadow-[var(--shadow-card)]">
          <div className="orb -top-20 -right-16 size-52 bg-[var(--primary)] opacity-15" />
          <div className="relative flex items-center gap-5">
            <ProgressRing value={saved} max={quota} size={92} stroke={9} tone={quotaDone ? "success" : "primary"}>
              <span className="display text-xl leading-none tabular-nums">{Math.round((saved / Math.max(1, quota)) * 100)}%</span>
              <span className="text-[10px] text-[var(--muted)]">cuota</span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--primary)] uppercase">Nueva entrevista</p>
              <h1 className="display mt-1 text-[26px] leading-tight text-[var(--foreground)]">{surveyTitle}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {total} preguntas · {saved}/{quota} casos · hoy {today}
              </p>
            </div>
          </div>

          {draft ? (
            <div className="relative mt-5 rounded-2xl border border-[color-mix(in_oklab,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4">
              <div className="flex items-start gap-3">
                <History className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--warning)]">Tenés una entrevista sin terminar</p>
                  <p className="mt-0.5 text-xs text-[var(--warning)] opacity-80">
                    Guardada {ago(draft.savedAt)} · {Object.keys(draft.values).length} respuestas
                    {draft.extra?.zone ? ` · ${draft.extra.zone}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => resume(draft)}>
                  Retomar
                  <ArrowRight />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    interview.clearDraft();
                    setDraft(null);
                  }}
                >
                  <Trash2 />
                  Descartar
                </Button>
              </div>
            </div>
          ) : null}

          <label className="relative mt-5 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[var(--foreground)]">
              <MapPin className="size-3.5 text-[var(--muted)]" />
              Zona del relevamiento
            </span>
            <ZoneSearch
              value={zone}
              onChange={setZone}
              recents={zones}
              placeholder="Santa Lucía, Chimbas, Rawson…"
            />
            <span className="mt-1.5 block text-xs text-[var(--muted)]">
              {zoneQuota
                ? `Cuota en ${zoneQuota.zone}: ${zoneQuota.quota} casos.`
                : "Escribí 3 letras para buscar el departamento. Al empezar se pide ubicación."}
            </span>
          </label>
          {queued ? (
            <p className="relative mt-4 rounded-xl bg-[var(--warning-soft)] px-3.5 py-2.5 text-sm text-[var(--warning)]">
              {queued} entrevista{queued === 1 ? "" : "s"} en cola. Se suben cuando haya señal.
            </p>
          ) : null}

          {quotaDone ? (
            <p className="relative mt-4 rounded-xl bg-[var(--success-soft)] px-3.5 py-2.5 text-sm text-[var(--success)]">
              Ya cumpliste tu cuota. Podés seguir cargando si la coordinación lo pide.
            </p>
          ) : null}

          <Button size="lg" className="relative mt-5 w-full" onClick={begin} disabled={total === 0 || !zone.trim()}>
            {draft ? "Empezar una nueva" : "Empezar"}
            <ArrowRight />
          </Button>

          {total === 0 ? (
            <p className="mt-3 text-center text-sm text-[var(--muted)]">Esta encuesta todavía no tiene preguntas cargadas.</p>
          ) : !zone.trim() ? (
            <p className="mt-3 text-center text-xs text-[var(--muted)]">Indicá la zona para empezar.</p>
          ) : null}
        </div>

        <Link
          href="/campo"
          className="flex items-center justify-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" />
          Volver a mis asignaciones
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------- en curso
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          <MapPin className="size-3.5 shrink-0" />
          {interview.extra?.zone || zone || "Sin zona"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[var(--success)] animate-pulse-soft" />
          Borrador guardado en el teléfono
        </span>
      </div>
      <div className="rounded-[26px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] p-5 shadow-[var(--shadow-card)] sm:p-7">
        <InterviewView interview={interview} onSubmit={submit} pending={pending} submitLabel="Guardar entrevista" />
      </div>
    </div>
  );
}
