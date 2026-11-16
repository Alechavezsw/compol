import * as React from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "primary" | "accent" | "success" | "warning";
  className?: string;
}) {
  const toneClass = {
    primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
    success: "bg-[var(--success-soft)] text-[var(--success)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  }[tone];

  // Un halo suave del color de la métrica en la esquina, en lugar de una franja.
  const glow = {
    primary: "var(--primary)",
    accent: "var(--accent)",
    success: "var(--success)",
    warning: "var(--warning)",
  }[tone];

  return (
    <div
      className={cn(
        "lift relative overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-[0.14] blur-2xl"
        style={{ background: glow }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-[var(--muted)]">{label}</p>
        {icon ? (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]", toneClass)}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="metric relative mt-3 text-[34px] leading-none text-[var(--foreground)]">{value}</p>
      {hint ? <div className="relative mt-2.5 text-xs text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}
