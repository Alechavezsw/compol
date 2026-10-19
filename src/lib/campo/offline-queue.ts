"use client";

import type { IncomingAnswer } from "@/lib/questions";

export type QueuedInterview = {
  id: string;
  /**
   * Identifica la entrevista de punta a punta: viaja al servidor, que no la
   * guarda dos veces si el envío se repite (la señal se cortó justo al responder).
   * Las que ya estaban en cola antes de existir este campo usan `id`.
   */
  clientId?: string;
  surveyId: string;
  zone: string | null;
  durationSeconds: number;
  answers: IncomingAnswer[];
  latitude: number | null;
  longitude: number | null;
  savedAt: number;
};

/**
 * Tope de la cola. Es mucho más que una jornada sin señal; se corta por abajo
 * en vez de descartar entrevistas nuevas sin avisar.
 */
const MAX_QUEUED = 500;

const keyFor = (surveyorId: string) => `consulta:cola:${surveyorId}`;

export function newClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function readQueue(surveyorId: string): QueuedInterview[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(surveyorId));
    const parsed = raw ? (JSON.parse(raw) as QueuedInterview[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeQueue(surveyorId: string, items: QueuedInterview[]) {
  window.localStorage.setItem(keyFor(surveyorId), JSON.stringify(items));
}

/**
 * Guarda una entrevista para enviarla después. Devuelve `null` si el teléfono no
 * tiene lugar o la cola está llena: quien llama tiene que avisar, porque en ese
 * caso la entrevista NO quedó guardada.
 */
export function enqueueInterview(
  surveyorId: string,
  item: Omit<QueuedInterview, "id" | "savedAt">,
): QueuedInterview | null {
  const next: QueuedInterview = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
  };
  const current = readQueue(surveyorId);
  if (current.length >= MAX_QUEUED) return null;
  try {
    writeQueue(surveyorId, [...current, next]);
    return next;
  } catch {
    return null;
  }
}

export function removeQueued(surveyorId: string, id: string) {
  try {
    writeQueue(
      surveyorId,
      readQueue(surveyorId).filter((item) => item.id !== id),
    );
  } catch {
    /* sin almacenamiento: la entrevista se reenvía y el servidor la reconoce por su clientId */
  }
}
