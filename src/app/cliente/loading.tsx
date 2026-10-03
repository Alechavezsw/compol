export default function ClienteLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-52 animate-pulse rounded-[28px] bg-[#0b1020]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-[22px] bg-[var(--surface-2)]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="h-80 animate-pulse rounded-[22px] bg-[var(--surface-2)] xl:col-span-3" />
        <div className="h-80 animate-pulse rounded-[22px] bg-[var(--surface-2)] xl:col-span-2" />
      </div>
    </div>
  );
}
