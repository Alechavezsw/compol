"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";

const OPTIONS: { value: Mode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "dark", label: "Oscuro", Icon: Moon },
];

export function applyTheme(mode: Mode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// La preferencia vive en localStorage, que es un store externo a React. Leerla
// con useSyncExternalStore evita el setState-en-effect y mantiene sincronizadas
// todas las instancias del toggle (hay una en la sidebar y otra en el footer).
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): Mode {
  try {
    return (localStorage.getItem("tema") as Mode | null) ?? "system";
  } catch {
    return "system";
  }
}

function getServerSnapshot(): Mode {
  return "system";
}

function setMode(mode: Mode) {
  try {
    localStorage.setItem("tema", mode);
  } catch {
    // Modo privado o storage bloqueado: aplicamos el tema igual.
  }
  applyTheme(mode);
  listeners.forEach((l) => l());
}

export function ThemeToggle({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Si el usuario eligió "sistema", seguimos los cambios del sistema operativo.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getSnapshot() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      role="group"
      aria-label="Tema de la interfaz"
      className={cn(
        "inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          aria-pressed={mode === value}
          title={label}
          className={cn(
            "flex size-7 items-center justify-center rounded-[7px] transition-colors",
            mode === value
              ? "bg-[var(--primary-soft)] text-[var(--primary)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          <Icon className="size-3.5" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
