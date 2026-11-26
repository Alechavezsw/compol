"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark";

const OPTIONS: { value: Mode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
];

export function applyTheme(mode: Mode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

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
    const stored = localStorage.getItem("tema");
    if (stored === "dark" || stored === "light") return stored;
    // Preferencia vieja "system" o sin valor: usamos lo que ya está pintado.
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  } catch {
    return "light";
  }
}

function getServerSnapshot(): Mode {
  return "light";
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
