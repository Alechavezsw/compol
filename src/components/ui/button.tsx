import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-all duration-200 " +
  "disabled:pointer-events-none disabled:opacity-50 active:translate-y-px " +
  "[&_svg]:shrink-0 [&_svg]:size-4";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] " +
    "shadow-[0_1px_0_rgba(255,255,255,.22)_inset,0_10px_24px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)] " +
    "hover:-translate-y-0.5 hover:shadow-[0_1px_0_rgba(255,255,255,.22)_inset,0_16px_28px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)]",
  secondary:
    "bg-[var(--primary-soft)] text-[var(--primary)] hover:brightness-97 dark:hover:brightness-125",
  outline:
    "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)] hover:border-[color-mix(in_oklab,var(--primary)_28%,var(--border))]",
  ghost: "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
  danger: "bg-[var(--danger)] text-white hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-9 w-9",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}
