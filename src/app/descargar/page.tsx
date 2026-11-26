import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BellOff, Maximize2, ShieldCheck, Smartphone, WifiOff, Zap } from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { InstallSteps } from "@/components/pwa/install-steps";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { CopyLink, InstallPanel } from "./install-panel";

export const metadata: Metadata = {
  title: "Descargar la app",
  description: `Instalá ${SITE_NAME} en el celular o la computadora: pantalla completa y encuestas de campo sin señal.`,
  alternates: { canonical: "/descargar" },
};

const BENEFITS = [
  {
    icon: WifiOff,
    title: "Campo sin señal",
    text: "Las encuestas asignadas se abren sin conexión y las entrevistas se suben solas al volver la señal.",
  },
  {
    icon: Maximize2,
    title: "Pantalla completa",
    text: "Sin barra del navegador: más lugar para el cuestionario y los tableros.",
  },
  {
    icon: Zap,
    title: "Un toque y adentro",
    text: "El ícono queda en la pantalla de inicio y abre directo en tu panel.",
  },
  {
    icon: ShieldCheck,
    title: "Sin tiendas ni permisos raros",
    text: "No pasa por Play Store ni App Store, no ocupa casi espacio y se actualiza sola.",
  },
];

export default function DescargarPage() {
  const shareUrl = absoluteUrl("/descargar");

  return (
    <div className="min-h-dvh pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <Link
          href="/login"
          className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          Ingresar
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-10 px-5 pt-4 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:gap-16 lg:pt-12">
        <section className="min-w-0 animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
            <Smartphone className="size-3.5 text-[var(--primary)]" />
            Android · iPhone · Computadora
          </p>
          <h1 className="display mt-5 text-[44px] leading-[0.95] text-[var(--foreground)] sm:text-[56px]">
            Llevá {SITE_NAME} en el bolsillo
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--muted)]">
            Se instala desde el navegador en unos segundos. Ideal para el equipo de campo: carga entrevistas
            aunque no haya señal.
          </p>

          <div className="mt-8 max-w-md">
            <InstallPanel />
          </div>

          <div className="mt-10 max-w-md">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
              Mandale este link a tu equipo
            </p>
            <div className="mt-2.5">
              <CopyLink url={shareUrl} />
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-4 animate-rise" style={{ animationDelay: "80ms" }}>
          <div className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
            <div className="orb -top-24 -right-20 size-60 bg-[var(--primary)] opacity-15" />
            <div className="relative flex items-center gap-4">
              <LogoMark className="size-16 rounded-[20px]" />
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">{SITE_NAME}</p>
                <p className="text-sm text-[var(--muted)]">Plataforma de encuestas</p>
              </div>
            </div>
            <ul className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {BENEFITS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--foreground)] marker:hidden">
              Pasos para cada dispositivo
              <span className="float-right text-[var(--muted)] transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-5 space-y-6">
              <InstallSteps platform="android" />
              <InstallSteps platform="ios" />
              <InstallSteps platform="desktop" />
            </div>
          </details>

          <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-[var(--muted)]">
            <BellOff className="mt-0.5 size-3.5 shrink-0" />
            La app no pide acceso a contactos, cámara ni notificaciones. En campo solo usa la ubicación, y te
            avisa antes.
          </p>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-10 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          <ArrowLeft className="size-4" />
          Volver al inicio
        </Link>
      </footer>
    </div>
  );
}
