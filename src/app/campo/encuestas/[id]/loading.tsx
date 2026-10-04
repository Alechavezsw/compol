export default function EntrevistaLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-5" aria-busy="true">
      <div className="rounded-[26px] border border-[var(--border)] p-6">
        <div className="h-3 w-28 rounded bg-[var(--surface-2)]" />
        <div className="mt-3 h-8 w-64 max-w-full rounded-lg bg-[var(--surface-2)]" />
        <div className="mt-5 h-12 rounded-2xl bg-[var(--surface-2)]" />
        <div className="mt-5 h-12 rounded-2xl bg-[var(--surface-2)]" />
      </div>
    </div>
  );
}
