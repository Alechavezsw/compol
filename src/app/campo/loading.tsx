/** Esqueleto de campo: en el celular, con señal floja, la pantalla no debe quedar en blanco. */
export default function CampoLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded-lg bg-[var(--surface-2)]" />
        <div className="h-9 w-56 max-w-full rounded-lg bg-[var(--surface-2)]" />
        <div className="h-4 w-72 max-w-full rounded-lg bg-[var(--surface-2)]" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-[var(--surface-2)]" />
        ))}
      </div>
      <div className="h-52 rounded-[22px] bg-[var(--surface-2)]" />
      <span className="sr-only">Cargando tus asignaciones…</span>
    </div>
  );
}
