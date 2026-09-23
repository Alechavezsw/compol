"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAnswered,
  resolvePath,
  triggersEnd,
  validateAnswer,
  validateInterview,
  type AnswerMap,
  type AnswerValue,
} from "@/lib/survey-logic";
import type { QuestionWithOptions } from "@/lib/types";

export type SubmitAnswer = {
  question_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  option_ids: string[];
};

export type Draft<Extra = unknown> = {
  values: AnswerMap;
  cursor: number;
  startedAt: number;
  savedAt: number;
  extra?: Extra;
};

type Stage = "question" | "review" | "ended";

const DRAFT_TTL = 1000 * 60 * 60 * 12;

function readDraft<Extra>(key: string | undefined): Draft<Extra> | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft<Extra>;
    if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

/**
 * Estado de una entrevista: recorrido con saltos, validación paso a paso,
 * pantalla de revisión y borrador en localStorage. No dibuja nada: el campo y
 * el widget web ponen su propia cáscara encima del mismo motor.
 */
export function useInterview<Extra = unknown>({
  questions,
  storageKey,
}: {
  questions: QuestionWithOptions[];
  storageKey?: string;
}) {
  const [values, setValues] = useState<AnswerMap>({});
  const [cursor, setCursor] = useState(0);
  const [stage, setStage] = useState<Stage>("question");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [extra, setExtra] = useState<Extra | undefined>(undefined);
  const startedAt = useRef(0);
  // Espejo sincrónico de `values` para el avance automático, que corre en un
  // timeout y vería un estado viejo si leyera el de React.
  const valuesRef = useRef<AnswerMap>({});
  const advanceTimer = useRef<number | null>(null);

  const { path, endedAt } = useMemo(() => resolvePath(questions, values), [questions, values]);
  const safeCursor = Math.min(cursor, Math.max(0, path.length - 1));
  const current = path[safeCursor];

  // --- borrador ------------------------------------------------------------
  useEffect(() => {
    if (!storageKey || !active) return;
    const id = window.setTimeout(() => {
      try {
        const draft: Draft<Extra> = {
          values,
          cursor: safeCursor,
          startedAt: startedAt.current,
          savedAt: Date.now(),
          extra,
        };
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        // Sin almacenamiento (modo privado): la entrevista sigue igual, sin borrador.
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [storageKey, active, values, safeCursor, extra]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const clearDraft = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* nada que limpiar */
    }
  }, [storageKey]);

  const pendingDraft = useCallback(() => readDraft<Extra>(storageKey), [storageKey]);

  // --- ciclo ---------------------------------------------------------------
  const start = useCallback((initialExtra?: Extra) => {
    startedAt.current = Date.now();
    valuesRef.current = {};
    setValues({});
    setCursor(0);
    setStage("question");
    setError(null);
    setExtra(initialExtra);
    setActive(true);
  }, []);

  const restore = useCallback((draft: Draft<Extra>) => {
    startedAt.current = draft.startedAt || Date.now();
    valuesRef.current = draft.values ?? {};
    setValues(draft.values ?? {});
    setCursor(draft.cursor ?? 0);
    setStage("question");
    setError(null);
    setExtra(draft.extra);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    clearDraft();
  }, [clearDraft]);

  const setValue = useCallback((questionId: string, value: AnswerValue | undefined) => {
    const next = { ...valuesRef.current, [questionId]: value };
    valuesRef.current = next;
    setValues(next);
    setError(null);
  }, []);

  /** Valida la pregunta visible con el estado más reciente. */
  const checkCurrent = useCallback(
    (vals: AnswerMap, q: QuestionWithOptions | undefined) => {
      if (!q) return null;
      const v = vals[q.id];
      if (q.is_required && !isAnswered(q, v)) return "Esta pregunta es obligatoria.";
      return validateAnswer(q, v);
    },
    [],
  );

  const next = useCallback(() => {
    const vals = valuesRef.current;
    const { path: livePath } = resolvePath(questions, vals);
    const idx = Math.min(cursor, Math.max(0, livePath.length - 1));
    const q = livePath[idx];
    const message = checkCurrent(vals, q);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    if (q && triggersEnd(q, vals[q.id])) {
      setStage("ended");
      return;
    }
    if (idx < livePath.length - 1) setCursor(idx + 1);
    else setStage("review");
  }, [questions, cursor, checkCurrent]);

  /** Guarda y avanza solo en preguntas de un toque (opción única, sí/no, escala). */
  const answerAndAdvance = useCallback(
    (questionId: string, value: AnswerValue) => {
      setValue(questionId, value);
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => next(), 280);
    },
    [setValue, next],
  );

  const prev = useCallback(() => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    setError(null);
    if (stage !== "question") {
      setStage("question");
      return;
    }
    setCursor((c) => Math.max(0, Math.min(c, path.length - 1) - 1));
  }, [stage, path.length]);

  const goTo = useCallback(
    (questionId: string) => {
      const idx = path.findIndex((q) => q.id === questionId);
      if (idx < 0) return;
      setCursor(idx);
      setStage("question");
      setError(null);
    },
    [path],
  );

  /** Respuestas listas para enviar: solo las del recorrido, ya validadas. */
  const collect = useCallback(() => {
    const vals = valuesRef.current;
    const check = validateInterview(questions, vals);
    const answers: SubmitAnswer[] = check.path
      .filter((q) => isAnswered(q, vals[q.id]))
      .map((q) => {
        const v = vals[q.id] as AnswerValue;
        return {
          question_id: q.id,
          value_text: v.text ?? null,
          value_number: typeof v.number === "number" ? v.number : null,
          value_date: v.date ?? null,
          option_ids: v.optionIds ?? [],
        };
      });
    return {
      answers,
      errors: check.errors,
      ended: Boolean(check.endedAt),
      durationSeconds: startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0,
    };
  }, [questions]);

  return {
    active,
    stage,
    values,
    path,
    endedAt,
    current,
    cursor: safeCursor,
    error,
    setError,
    extra,
    setExtra,
    start,
    restore,
    stop,
    pendingDraft,
    clearDraft,
    setValue,
    answerAndAdvance,
    next,
    prev,
    goTo,
    collect,
    answeredCount: path.filter((q) => isAnswered(q, values[q.id])).length,
  };
}

export type Interview<Extra = unknown> = ReturnType<typeof useInterview<Extra>>;
