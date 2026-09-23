import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] shadow-[0_8px_18px_-8px_color-mix(in_oklab,var(--primary)_80%,transparent)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <rect x="3" y="12" width="4" height="9" rx="1.4" fill="currentColor" opacity=".55" />
        <rect x="10" y="7" width="4" height="14" rx="1.4" fill="currentColor" opacity=".8" />
        <rect x="17" y="3" width="4" height="18" rx="1.4" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({
  compact = false,
  href = "/",
  className,
  invert = false,
}: {
  compact?: boolean;
  href?: string;
  className?: string;
  invert?: boolean;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-[16px] font-semibold tracking-tight",
              invert ? "text-white" : "text-[var(--foreground)]",
            )}
          >
            Consulta
          </span>
          <span
            className={cn(
              "mt-0.5 text-[11px] font-medium tracking-wide",
              invert ? "text-white/65" : "text-[var(--muted)]",
            )}
          >
            Plataforma de encuestas
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-tight",
            invert ? "text-white" : "text-[var(--foreground)]",
          )}
        >
          Consulta
        </span>
      )}
    </Link>
  );
}
