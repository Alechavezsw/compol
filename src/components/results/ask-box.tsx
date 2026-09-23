"use client";

import { useState, useTransition } from "react";
import { ArrowUp, Loader2, MessageCircleQuestion, Sparkles } from "lucide-react";
import { askSurveyAction } from "@/app/cliente/actions";
import { Markdown } from "@/components/markdown";
import type { AnalyticsFilters } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Turn = { question: string; answer?: string; source?: string; error?: string };

export function AskBox({
  surveyId,
  filters,
  suggestions,
  withModel,
}: {
  surveyId: string;
  filters: AnalyticsFilters;
  suggestions: string[];
  withModel: boolean;
}) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, startTransition] = useTransition();

  function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setInput("");
    setTurns((prev) => [...prev, { question: q }]);
    startTransition(async () => {
      const result = await askSurveyAction({ surveyId, question: q, filters });
      setTurns((prev) =>
        prev.map((t, i) =>
          i === prev.length - 1
            ? result.ok
              ? { ...t, answer: result.answer, source: result.source }
              : { ...t, error: result.error ?? "No se pudo responder." }
            : t,
        ),
      );
    });
  }

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[color-mix(in_oklab,var(--accent)_28%,var(--border))] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent-soft)_70%,var(--surface)),var(--surface)_55%)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="orb -top-16 -right-10 size-44 bg-[var(--accent)] opacity-15" />
      <div className="relative flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-[0_10px_22px_-12px_var(--accent)]">
          <MessageCircleQuestion className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">Preguntale a los datos</h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {withModel
              ? "Gemini responde sobre los agregados de este tablero, con los filtros aplicados."
              : "Sin clave de Gemini: la respuesta es una lectura directa de las cifras, sin interpretación."}
          </p>
        </div>
      </div>

      {turns.length ? (
        <div className="relative mt-5 max-h-[420px] space-y-4 overflow-y-auto pr-1">
          {turns.map((t, i) => (
            <div key={i} className="space-y-2 animate-rise">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--primary)] px-3.5 py-2 text-sm text-[var(--primary-fg)]">
                {t.question}
              </p>
              <div className="max-w-[95%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                {t.answer ? (
                  <>
                    <div className="[&_p]:my-1.5 [&_ul]:my-1.5 [&>div]:text-sm">
                      <Markdown>{t.answer}</Markdown>
                    </div>
                    {t.source ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                        <Sparkles className="size-3" />
                        {t.source}
                      </p>
                    ) : null}
                  </>
                ) : t.error ? (
                  <p className="text-[var(--danger)]">{t.error}</p>
                ) : (
                  <p className="inline-flex items-center gap-2 text-[var(--muted)]">
                    <Loader2 className="size-4 animate-spin" />
                    Leyendo los datos…
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="relative mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={400}
          placeholder="¿Qué zona evalúa peor la gestión?"
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--accent)_16%,transparent)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Preguntar"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all disabled:opacity-40",
            !pending && input.trim() && "hover:-translate-y-0.5",
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </form>
    </div>
  );
}
