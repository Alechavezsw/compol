"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Clock, Lock, X } from "lucide-react";
import { submitWebResponseAction } from "../actions";
import { useInterview } from "@/components/interview/use-interview";
import { InterviewView } from "@/components/interview/interview-view";
import type { QuestionWithOptions } from "@/lib/types";
import type { ResolvedWebSettings } from "@/lib/web";
import { cn } from "@/lib/utils";

type Stage = "welcome" | "running" | "thanks" | "repeated";

function post(message: Record<string, unknown>) {
  if (window.parent !== window) window.parent.postMessage({ source: "consulta", ...message }, "*");
}

function deviceId() {
  try {
    const key = "consulta:dispositivo";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "sin-dispositivo";
  }
}

export function WebSurvey({
  token,
  questions,
  settings,
  organizationName,
  embed,
  closable,
  sourceUrl,
  open,
}: {
  token: string;
  questions: QuestionWithOptions[];
  settings: ResolvedWebSettings;
  organizationName: string | null;
  embed: boolean;
  closable: boolean;
  sourceUrl: string | null;
  open: boolean;
}) {
  const interview = useInterview({ questions, storageKey: `consulta:web:${token}` });
  const [stage, setStage] = useState<Stage>("welcome");
  const [pending, startTransition] = useTransition();
  const [website, setWebsite] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const doneKey = `consulta:web:respondida:${token}`;

  // Si el navegador ya respondió, lo decimos de entrada en vez de al final.
  useEffect(() => {
    try {
      if (settings.onePerDevice && localStorage.getItem(doneKey)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de almacenamiento del navegador
        setStage("repeated");
        return;
      }
      const draft = interview.pendingDraft();
      if (draft && Object.keys(draft.values).length) {
        interview.restore(draft);
        setStage("running");
      }
    } catch {
      /* sin almacenamiento: flujo normal */
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El iframe no sabe cuánto mide su contenido: se lo avisamos al widget.
  useEffect(() => {
    if (!embed || !root.current) return;
    const el = root.current;
    const observer = new ResizeObserver(() => post({ type: "resize", height: Math.ceil(el.scrollHeight) }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [embed]);

  function begin() {
    interview.start();
    setStage("running");
    post({ type: "start" });
  }

  function submit() {
    const { answers, errors, durationSeconds } = interview.collect();
    if (errors.length) {
      interview.goTo(errors[0].questionId);
      interview.setError(errors[0].message);
      return;
    }
    startTransition(async () => {
      const result = await submitWebResponseAction({
        token,
        answers,
        durationSeconds,
        deviceId: deviceId(),
        sourceUrl,
        website,
      });
      if (!result.ok) {
        if (result.duplicate) {
          interview.stop();
          setStage("repeated");
          return;
        }
        interview.setError(result.error ?? "No se pudo enviar. Probá de nuevo.");
        return;
      }
      interview.stop();
      try {
        localStorage.setItem(doneKey, new Date().toISOString());
      } catch {
        /* sin almacenamiento */
      }
      setStage("thanks");
      post({ type: "done", status: result.status });
    });
  }

  const minutes = Math.max(1, Math.round(questions.length * 0.35));

  return (
    <div
      ref={root}
      className={cn("web-survey force-light", embed ? "p-0" : "px-4 py-8 sm:py-14")}
      style={
        {
          "--primary": settings.accent,
          "--primary-hover": `color-mix(in oklab, ${settings.accent} 85%, black)`,
          "--primary-soft": `color-mix(in oklab, ${settings.accent} 12%, white)`,
          "--primary-fg": "#ffffff",
          "--ring": settings.accent,
          "--accent": `color-mix(in oklab, ${settings.accent} 60%, #0d9a86)`,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "relative mx-auto w-full overflow-hidden bg-[var(--surface)]",
          embed ? "min-h-full rounded-none" : "max-w-xl rounded-[28px] border border-[var(--border)] shadow-[0_40px_90px_-40px_rgba(20,10,60,.45)]",
        )}
      >
        <div
          className="h-1.5 w-full"
          style={{ background: `linear-gradient(90deg, ${settings.accent}, color-mix(in oklab, ${settings.accent} 40%, #2dd4bf))` }}
        />

        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <span className="truncate text-xs font-semibold tracking-wide text-[var(--muted)]">
            {organizationName ?? "Consulta"}
          </span>
          {closable ? (
            <button
              type="button"
              onClick={() => post({ type: "close" })}
              aria-label="Cerrar encuesta"
              className="rounded-full p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="px-6 pt-3 pb-6">
          {stage === "welcome" ? (
            <div className="animate-rise">
              <h1 className="display text-[30px] leading-[1.08] text-balance text-[var(--foreground)]">{settings.welcomeTitle}</h1>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{settings.welcomeText}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1">
                  <Clock className="size-3.5" />~{minutes} min
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1">
                  <Lock className="size-3.5" />
                  Anónima
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1">
                  {questions.length} preguntas
                </span>
              </div>
              <button
                type="button"
                onClick={begin}
                disabled={!open || questions.length === 0}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-[15px] font-semibold text-white shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-110 active:translate-y-px disabled:opacity-50"
              >
                {open ? "Empezar" : "La consulta está cerrada"}
                {open ? <ArrowRight className="size-4" /> : null}
              </button>
            </div>
          ) : null}

          {stage === "running" ? (
            <>
              <InterviewView interview={interview} onSubmit={submit} pending={pending} variant="web" submitLabel="Enviar respuestas" />
              {/* Trampa para bots: fuera de pantalla y fuera del orden de tabulación. */}
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                name="website"
              />
            </>
          ) : null}

          {stage === "thanks" || stage === "repeated" ? (
            <div className="animate-rise py-4 text-center">
              <span
                className="mx-auto flex size-16 items-center justify-center rounded-full text-white shadow-[0_16px_30px_-14px_var(--primary)]"
                style={{ background: settings.accent }}
              >
                <CheckCircle2 className="size-8" />
              </span>
              <h2 className="display mt-5 text-[28px] leading-tight text-[var(--foreground)]">
                {stage === "thanks" ? settings.thanksTitle : "Ya participaste"}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[var(--muted)]">
                {stage === "thanks"
                  ? settings.thanksText
                  : "Registramos una respuesta desde este dispositivo. ¡Gracias por sumar tu opinión!"}
              </p>
              {closable ? (
                <button
                  type="button"
                  onClick={() => post({ type: "close" })}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--border)] px-5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                >
                  Cerrar
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t border-[var(--border)] px-6 py-3 text-[11px] text-[var(--muted)]">
          <Lock className="size-3" />
          Respuestas anónimas · con tecnología de <strong className="font-semibold text-[var(--foreground)]">Consulta</strong>
        </div>
      </div>
    </div>
  );
}
