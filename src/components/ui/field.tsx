import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] " +
  "placeholder:text-[var(--muted)] transition-all " +
  "hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border))] " +
  "focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_16%,transparent)] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[13px] font-medium text-[var(--foreground)]", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(control, "h-10 appearance-none bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.75rem center",
      }}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      {label ? <Label>{label}</Label> : null}
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs text-[var(--muted)]">{hint}</p> : null}
      {error ? <p className="mt-1.5 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-xl px-3.5 py-2.5 text-sm",
        tone === "error"
          ? "bg-[var(--danger-soft)] text-[var(--danger)]"
          : "bg-[var(--success-soft)] text-[var(--success)]",
      )}
    >
      {children}
    </p>
  );
}
