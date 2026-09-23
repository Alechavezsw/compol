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

  const bar = {
    primary: "from-[var(--primary)] to-[var(--accent)]",
    accent: "from-[var(--accent)] to-[var(--primary)]",
    success: "from-[var(--success)] to-[var(--accent)]",
    warning: "from-[var(--warning)] to-[var(--primary)]",
  }[tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-5 shadow-[var(--shadow-card)] backdrop-blur-sm",
        className,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", bar)} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-[var(--muted)]">{label}</p>
        {icon ? (
          <span className={cn("flex size-9 items-center justify-center rounded-xl", toneClass)}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="display mt-4 text-[32px] leading-none text-[var(--foreground)] tabular-nums">
        {value}
      </p>
      {hint ? <div className="mt-2.5 text-xs text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}
