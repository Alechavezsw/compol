import * as React from "react";
import { cn, initials } from "@/lib/utils";

export function Progress({
  value,
  max = 100,
  className,
  tone = "primary",
}: {
  value: number;
  max?: number;
  className?: string;
  tone?: "primary" | "accent" | "success";
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bg =
    tone === "accent" ? "var(--accent)" : tone === "success" ? "var(--success)" : "var(--primary)";
  return (
    <div
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${bg}, color-mix(in oklab, ${bg} 55%, var(--accent)))`,
        }}
      />
    </div>
  );
}

/** Anillo de avance en SVG: se lee bien chico y no depende de librerías. */
export function ProgressRing({
  value,
  max = 100,
  size = 88,
  stroke = 9,
  tone = "primary",
  children,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: "primary" | "accent" | "success" | "warning" | "danger";
  children?: React.ReactNode;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = `var(--${tone})`;
  const id = React.useId();
  return (
    <div className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            {/* Solo el tono de marca degrada al acento: en alertas el color tiene que leerse limpio. */}
            <stop offset="100%" stopColor={tone === "primary" ? "var(--accent)" : color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Aviso contextual de una sola línea (flash de acciones, advertencias). */
export function Notice({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
    primary: "border-[color-mix(in_oklab,var(--primary)_22%,var(--border))] bg-[var(--primary-soft)] text-[var(--primary)]",
    success: "border-[color-mix(in_oklab,var(--success)_22%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]",
    warning: "border-[color-mix(in_oklab,var(--warning)_22%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
    danger: "border-[color-mix(in_oklab,var(--danger)_22%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
  }[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-snug", tones, className)}>
      {icon ? <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[22px] border border-dashed border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
          {icon}
        </div>
      ) : null}
      <p className="display text-xl text-[var(--foreground)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] font-semibold text-[var(--primary-fg)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name || "?")}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="display text-[32px] leading-[1.1] text-[var(--foreground)] sm:text-[38px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** Contenedor con scroll horizontal para tablas anchas en movil. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-[var(--muted)] uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 text-sm text-[var(--foreground)]", className)} {...props} />;
}
