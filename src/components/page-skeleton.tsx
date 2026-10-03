export function PageSkeleton() {
  return (
    <div className="space-y-7" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-8 w-52 max-w-full rounded-lg bg-[var(--surface-2)]" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-[var(--surface-2)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-[var(--surface-2)]" />
        ))}
      </div>
      <div className="h-80 rounded-2xl bg-[var(--surface-2)]" />
    </div>
  );
}
