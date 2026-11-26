"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  FolderKanban,
  IdCard,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MoreHorizontal,
  Radar,
  Receipt,
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
import { SkipLink } from "@/components/skip-link";
import { ConnectionStatus } from "@/components/pwa/connection-status";
import { InstallButton } from "@/components/pwa/install-button";
import { InstallNudge } from "@/components/pwa/install-nudge";

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
  | "social"
  | "billing"
  | "accounting"
  | "leaders";

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
  billing: Receipt,
  accounting: Landmark,
  leaders: IdCard,
};

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  /** Agrupa ítems bajo un encabezado en el menú lateral. */
  section?: string;
};

/**
 * Pestañas de la barra inferior en el celular: las pantallas que más se usan
 * en cada área, en este orden. El resto queda a mano en "Más".
 */
const MOBILE_TABS = [
  "/campo",
  "/admin",
  "/admin/encuestas",
  "/admin/resultados",
  "/cliente",
  "/cliente/encuestas",
  "/cliente/informes",
  "/cliente/redes",
  "/cliente/dirigentes",
  "/admin/organizaciones",
];
const MAX_TABS = 4;

/** Rótulos cortos para que entren debajo del ícono. */
const SHORT_LABEL: Record<string, string> = {
  "/campo": "Asignaciones",
  "/admin": "Panel",
  "/cliente": "Resumen",
  "/cliente/redes": "Radar",
  "/admin/organizaciones": "Clientes",
};

function mobileTabs(nav: NavItem[]) {
  const byHref = new Map(nav.map((item) => [item.href, item]));
  const picked = MOBILE_TABS.flatMap((href) => {
    const item = byHref.get(href);
    return item ? [item] : [];
  });
  return (picked.length ? picked : nav).slice(0, MAX_TABS);
}

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
  offlineHint,
  installMessage,
  children,
}: {
  nav: NavItem[];
  user: ShellUser;
  areaLabel: string;
  orgName?: string | null;
  /** Server Component opcional que se pinta arriba del contenido. */
  banner?: React.ReactNode;
  /** Qué decir cuando se corta la señal (campo aclara que las entrevistas se guardan). */
  offlineHint?: string;
  /** Texto de la invitación a instalar la app en el celular. */
  installMessage?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const tabs = mobileTabs(nav);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    for (const item of nav) router.prefetch(item.href);
  }, [nav, router]);

  // Al llegar a la pantalla nueva se apaga la barra de carga y se cierra el menú.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setPendingHref(null);
    setOpen(false);
  }

  useEffect(() => {
    if (!pendingHref) return;
    const timer = window.setTimeout(() => setPendingHref(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [pendingHref]);

  const isActive = (item: NavItem) => {
    const current = pendingHref ?? pathname;
    return item.exact ? current === item.href : current === item.href || current.startsWith(`${item.href}/`);
  };

  const go = (item: NavItem) => (event: React.MouseEvent) => {
    setOpen(false);
    if (pathname === item.href) {
      event.preventDefault();
      setPendingHref(null);
      return;
    }
    setPendingHref(item.href);
  };

  // En la barra inferior se marca la sección más específica que contiene la
  // pantalla actual (una encuesta de campo marca "Asignaciones"). Si esa
  // sección no tiene pestaña propia, se marca "Más".
  const current = pendingHref ?? pathname;
  const within = (href: string) => current === href || current.startsWith(`${href}/`);
  const deepest = (items: NavItem[]) =>
    items.filter((item) => within(item.href)).sort((a, b) => b.href.length - a.href.length)[0];
  const activeTabHref = (() => {
    const section = deepest(nav);
    if (section) return tabs.some((t) => t.href === section.href) ? section.href : null;
    return deepest(tabs)?.href ?? null;
  })();
  const moreActive = activeTabHref === null;

  const sidebar = (
    <div className="flex h-full flex-col gap-1 bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:pt-0 lg:pb-0">
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
        <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--primary-soft)_55%,var(--surface-2))] px-3.5 py-3">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[var(--primary)] uppercase">
            {areaLabel}
          </p>
          {orgName ? (
            <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">{orgName}</p>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {nav.map((item, index) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item);
          const showSection = Boolean(item.section && (index === 0 || nav[index - 1]?.section !== item.section));
          return (
            <div key={item.href}>
              {showSection ? (
                <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase first:pt-1">
                  {item.section}
                </p>
              ) : null}
              <Link
                href={item.href}
                prefetch
                onClick={go(item)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-all lg:py-2.5 lg:text-sm",
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
            </div>
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
        <InstallButton size="sm" variant="outline" label="Instalar la app" className="mt-2 w-full lg:hidden" />
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
      <SkipLink />
      {pendingHref ? (
        <div className="print-hidden pointer-events-none fixed top-0 right-0 left-0 z-50 h-0.5 overflow-hidden lg:left-[272px]">
          <div className="h-full w-1/3 rounded-full bg-[var(--primary)] animate-nav-progress" />
        </div>
      ) : null}
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
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] border-r border-[var(--border)] bg-[var(--surface)] shadow-2xl animate-rise">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[272px] print:pl-0">
        <header className="print-hidden sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center gap-3 px-4">
            <Logo compact href={tabs[0]?.href ?? "/inicio"} />
            <div className="ml-auto min-w-0 text-right">
              <p className="truncate text-[10px] font-semibold tracking-[0.14em] text-[var(--primary)] uppercase">
                {areaLabel}
              </p>
              {orgName ? (
                <p className="max-w-[52vw] truncate text-xs font-medium text-[var(--foreground)]">{orgName}</p>
              ) : null}
            </div>
            <Avatar name={user.name} src={user.avatarUrl} size={32} />
          </div>
        </header>

        <main
          id="contenido"
          className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-10 print:pb-0"
        >
          <ConnectionStatus hint={offlineHint} />
          <InstallNudge message={installMessage} />
          <div className="print-hidden">{banner}</div>
          {children}
        </main>
      </div>

      {/* Barra inferior: lo que más se usa queda al alcance del pulgar. */}
      <nav
        aria-label="Navegación principal"
        className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {tabs.map((item) => {
            const Icon = ICONS[item.icon];
            const active = item.href === activeTabHref;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  prefetch
                  onClick={go(item)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-[var(--primary)]" : "text-[var(--muted)] active:text-[var(--foreground)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active && "bg-[var(--primary-soft)]",
                    )}
                  >
                    <Icon className="size-[19px]" />
                  </span>
                  <span className="max-w-full truncate px-1">{SHORT_LABEL[item.href] ?? item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Más opciones"
              aria-expanded={open}
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                moreActive ? "text-[var(--primary)]" : "text-[var(--muted)] active:text-[var(--foreground)]",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  moreActive && "bg-[var(--primary-soft)]",
                )}
              >
                <MoreHorizontal className="size-[19px]" />
              </span>
              Más
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
