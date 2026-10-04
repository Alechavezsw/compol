"use client";

import type { IncomingAnswer } from "@/lib/questions";

export type QueuedInterview = {
  id: string;
  surveyId: string;
  zone: string | null;
  durationSeconds: number;
  answers: IncomingAnswer[];
  latitude: number | null;
  longitude: number | null;
  savedAt: number;
};

const keyFor = (surveyorId: string) => `consulta:cola:${surveyorId}`;

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
  window.localStorage.setItem(keyFor(surveyorId), JSON.stringify(items.slice(0, 40)));
}

export function enqueueInterview(surveyorId: string, item: Omit<QueuedInterview, "id" | "savedAt">) {
  const next: QueuedInterview = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
  };
  writeQueue(surveyorId, [...readQueue(surveyorId), next]);
  return next;
}

export function removeQueued(surveyorId: string, id: string) {
  writeQueue(
    surveyorId,
    readQueue(surveyorId).filter((item) => item.id !== id),
  );
}
