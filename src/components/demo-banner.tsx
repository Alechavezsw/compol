import { FlaskConical, RotateCcw } from "lucide-react";
import { resetDemoAction } from "@/app/demo-actions";

/**
 * Aviso permanente mientras la app corre sobre datos simulados. Que se vea en
 * todas las áreas es deliberado: nadie debería confundir la demo con datos
 * reales de un organismo.
 */
export function DemoBanner() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[color-mix(in_oklab,var(--warning)_22%,var(--border))] bg-[var(--warning-soft)] px-4 py-3 shadow-[var(--shadow-card)]">
      <FlaskConical className="size-4 shrink-0 text-[var(--warning)]" />
      <p className="min-w-0 flex-1 text-xs leading-snug text-[var(--warning)]">
        <strong className="font-semibold">Modo demo.</strong> Datos simulados en memoria del
        servidor. Los cambios que hagas son reales dentro de la sesión, pero se pierden al
        reiniciar.
      </p>
      <form action={resetDemoAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--warning)] transition-colors hover:bg-[color-mix(in_oklab,var(--warning)_12%,transparent)]"
        >
          <RotateCcw className="size-3" />
          Reiniciar datos
        </button>
      </form>
    </div>
  );
}
