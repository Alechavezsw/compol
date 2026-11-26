import type { Metadata } from "next";
import { ArrowRight, ClipboardList, RotateCcw, WifiOff } from "lucide-react";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = {
  title: "Sin conexión",
  robots: { index: false, follow: false },
};

// La guarda el service worker al instalarse: tiene que ser estática y andar sin JavaScript.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto w-fit">
          <LogoMark className="size-16 rounded-[22px]" />
          <span className="absolute -right-2 -bottom-2 flex size-8 items-center justify-center rounded-full border-4 border-[var(--background)] bg-[var(--warning-soft)] text-[var(--warning)]">
            <WifiOff className="size-3.5" />
          </span>
        </div>

        <h1 className="display mt-7 text-[34px] leading-none text-[var(--foreground)]">Sin conexión</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Esta pantalla necesita señal. Las encuestas de campo que ya abriste con señal siguen disponibles, y
          las entrevistas que cargues quedan guardadas en el teléfono hasta que vuelva la conexión.
        </p>

        <div className="mt-8 space-y-3">
          {/* Enlaces comunes: esta página tiene que funcionar aunque el JavaScript no haya cargado. */}
          <a
            href="/campo"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-[15px] font-medium text-[var(--primary-fg)]"
          >
            <ClipboardList className="size-4" />
            Ir a mis encuestas de campo
            <ArrowRight className="size-4" />
          </a>
          <a
            href="/inicio"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 text-[15px] font-medium text-[var(--foreground)]"
          >
            <RotateCcw className="size-4" />
            Reintentar
          </a>
        </div>
      </div>
    </main>
  );
}
