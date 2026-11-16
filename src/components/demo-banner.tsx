import { FlaskConical, RotateCcw } from "lucide-react";
import { resetDemoAction } from "@/app/demo-actions";

/**
 * Aviso permanente mientras la app corre sobre datos simulados. Que se vea en
 * todas las áreas es deliberado: nadie debería confundir la demo con datos
 * reales de un organismo. Va en una franja fina para no competir con el contenido.
 */
export function DemoBanner() {
  return (
    <div className="mb-6 flex items-center gap-2.5 rounded-full border border-[color-mix(in_oklab,var(--warning)_25%,var(--border))] bg-[color-mix(in_oklab,var(--warning-soft)_75%,var(--surface))] py-1.5 pr-1.5 pl-3.5">
      <FlaskConical className="size-3.5 shrink-0 text-[var(--warning)]" />
      <p className="min-w-0 flex-1 truncate text-xs text-[var(--warning)]">
        <strong className="font-semibold">Modo demo</strong>
        <span className="hidden sm:inline"> · Datos simulados: los cambios se pierden al reiniciar.</span>
      </p>
      <form action={resetDemoAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--warning)] transition-colors hover:bg-[color-mix(in_oklab,var(--warning)_14%,transparent)]"
        >
          <RotateCcw className="size-3" />
          Reiniciar
        </button>
      </form>
    </div>
  );
}
