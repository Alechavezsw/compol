"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Radar,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type UserRole } from "@/lib/types";
import { Logo } from "@/components/logo";

export type IconName =
  | "dashboard"
  | "orgs"
  | "users"
  | "surveys"
  | "reports"
  | "projects"
  | "field"
  | "results"
  | "ai"
  | "social";

const ICONS: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  orgs: Building2,
  users: Users,
  surveys: ClipboardList,
  reports: FileText,
  projects: FolderKanban,
  field: ListChecks,
  results: BarChart3,
  ai: Sparkles,
  social: Radar,
};

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
};

export type ShellUser = {
  name: string;
  email: string | null;
  role: UserRole;
  avatarUrl?: string | null;
};

export function AppShell({
  nav,
  user,
  areaLabel,
  orgName,
  banner,
  children,
}: {
  nav: NavItem[];
  user: ShellUser;
  areaLabel: string;
  orgName?: string | null;
  /** Server Component opcional que se pinta arriba del contenido. */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const sidebar = (
    <div className="flex h-full flex-col gap-1 bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="px-5 pb-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
            {areaLabel}
          </p>
          {orgName ? (
            <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">{orgName}</p>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {nav.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
              )}
            >
              {active ? (
                <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--primary)]" />
              ) : null}
              <Icon className="size-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] px-2.5 py-2.5">
          <Avatar name={user.name} src={user.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--foreground)]">{user.name}</p>
            <p className="truncate text-xs text-[var(--muted)]">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <ThemeToggle />
          <form action="/auth/salir" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
            >
              <LogOut className="size-3.5" />
              Salir
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <aside className="print-hidden fixed inset-y-0 left-0 z-30 hidden w-[272px] border-r border-[var(--border)] lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] border-r border-[var(--border)] shadow-2xl animate-rise">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[272px] print:pl-0">
        <header className="print-hidden sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_78%,transparent)] px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
          <Logo compact />
          <div className="ml-auto flex items-center gap-2">
            <Gauge className="size-4 text-[var(--muted)]" />
            <span className="text-xs font-medium text-[var(--muted)]">{areaLabel}</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="print-hidden">{banner}</div>
          {children}
        </main>
      </div>
    </div>
  );
}
