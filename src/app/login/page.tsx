import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { isSupabaseConfigured } from "@/lib/auth";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#0c0a16] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="surface-grid pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="orb top-[-60px] left-[-40px] size-80 bg-[#6d5cff] opacity-40" />
        <div className="orb right-[-40px] bottom-[20%] size-72 bg-[#2dd4bf] opacity-25" />
        <div className="orb bottom-[-80px] left-[30%] size-64 bg-[#8b5cf6] opacity-20" />

        <div className="relative">
          <Logo invert />
        </div>
        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-white/50 uppercase">
            Acceso institucional
          </p>
          <h2 className="display mt-4 text-5xl leading-[1.05] text-white">
            El operativo, el tablero y el informe en un solo lugar.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-white/65">
            Cada organismo accede únicamente a sus propios relevamientos. El aislamiento se aplica
            en la base de datos, no en la interfaz.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              ["4", "roles"],
              ["RLS", "por fila"],
              ["IA", "citada"],
            ].map(([n, l]) => (
              <div
                key={l}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur"
              >
                <p className="display text-2xl text-white">{n}</p>
                <p className="mt-1 text-[11px] text-white/55">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-white/55">
          <ShieldCheck className="size-4" />
          Acceso restringido a usuarios habilitados
        </div>
      </aside>

      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo />
            <ThemeToggle />
          </div>

          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="size-4" />
            Volver al inicio
          </Link>

          <h1 className="display text-[34px] leading-tight text-[var(--foreground)]">
            Ingresar a la plataforma
          </h1>
          <p className="mt-2 mb-8 text-sm leading-relaxed text-[var(--muted)]">
            Usá las credenciales que te entregó tu organización.
          </p>

          <div className="rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] p-5 shadow-[var(--shadow-card)] backdrop-blur-sm">
            <LoginForm next={next} />
          </div>

          {!configured ? (
            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--warning-soft)] p-4 text-xs leading-relaxed text-[var(--warning)]">
              <strong className="font-semibold">Falta configurar Supabase.</strong> Copiá{" "}
              <code className="font-mono">.env.example</code> a{" "}
              <code className="font-mono">.env.local</code> y cargá la URL y la anon key de tu
              proyecto.
            </div>
          ) : null}

          <div className="mt-8 hidden justify-center lg:flex">
            <ThemeToggle />
          </div>
        </div>
      </main>
    </div>
  );
}
