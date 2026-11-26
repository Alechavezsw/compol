"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado de instalación de la app, compartido por el botón, el aviso del
 * panel y la página /descargar.
 *
 * - Android y Chrome/Edge de escritorio: hay un pedido nativo (`canPrompt`).
 * - iPhone/iPad: Safari no tiene pedido nativo; se explican los pasos.
 * - Ya instalada (`standalone`): no se ofrece nada.
 */

export type InstallPlatform = "ios" | "android" | "desktop";

export type InstallState = {
  /** false durante el render del servidor y la hidratación. */
  ready: boolean;
  standalone: boolean;
  canPrompt: boolean;
  platform: InstallPlatform;
  /** Se instaló en esta sesión del navegador (o en otra visita). */
  installedBefore: boolean;
  /** El usuario cerró el aviso del panel hace poco. */
  nudgeDismissed: boolean;
};

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __consultaInstall?: PromptEvent | null;
  }
}

const DISMISS_KEY = "consulta:instalar-aviso";
const DISMISS_DAYS = 14;

const SERVER_STATE: InstallState = {
  ready: false,
  standalone: false,
  canPrompt: false,
  platform: "desktop",
  installedBefore: false,
  nudgeDismissed: true,
};

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // iPadOS se presenta como Mac, pero con pantalla táctil.
  const iPadAsMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || iPadAsMac) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function compute(): InstallState {
  const dismissedAt = Number(readStorage(DISMISS_KEY) ?? 0);
  return {
    ready: true,
    standalone: isStandalone(),
    canPrompt: Boolean(window.__consultaInstall),
    platform: detectPlatform(),
    installedBefore: readStorage("consulta:instalada") === "1",
    nudgeDismissed: Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000,
  };
}

let snapshot: InstallState | null = null;
const listeners = new Set<() => void>();

function refresh() {
  snapshot = compute();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("consulta:instalable", refresh);
    window.addEventListener("consulta:instalada", refresh);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", refresh);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("consulta:instalable", refresh);
      window.removeEventListener("consulta:instalada", refresh);
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", refresh);
    }
  };
}

function getSnapshot() {
  if (!snapshot) snapshot = compute();
  return snapshot;
}

export function useInstallState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
}

/** Abre el diálogo nativo. Devuelve si la persona aceptó. */
export async function promptInstall(): Promise<boolean> {
  const event = window.__consultaInstall;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  // El mismo evento no se puede reutilizar.
  window.__consultaInstall = null;
  refresh();
  return outcome === "accepted";
}

export function dismissInstallNudge() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* sin almacenamiento: el aviso vuelve en la próxima visita */
  }
  refresh();
}
