/** Primer foco al tabular: salta la navegación y va directo al contenido (`id="contenido"`). */
export function SkipLink() {
  return (
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--primary-fg)] focus:shadow-lg"
    >
      Saltar al contenido
    </a>
  );
}
