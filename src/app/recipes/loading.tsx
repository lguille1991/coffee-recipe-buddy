export default function RecipesLoading() {
  return (
    <div className="ui-page-shell">
      <div className="ui-top-spacer" />

      <div className="px-4 sm:px-6 pb-4">
        <div className="h-8 w-36 bg-[var(--border)] rounded-lg animate-pulse ui-animate-enter-soft" />
      </div>

      <div className="px-4 sm:px-6 mb-4">
        <div className="h-14 bg-[var(--card)] border border-[var(--border)] rounded-xl animate-pulse" />
      </div>

      <div className="px-4 sm:px-6 mb-3">
        <div className="h-10 bg-[var(--card)] border border-[var(--border)] rounded-[12px] animate-pulse" />
      </div>

      <div className="px-4 sm:px-6 mb-4 flex gap-2 overflow-x-auto pb-2">
        {[80, 48, 64, 72, 56].map((w, i) => (
          <div key={i} style={{ width: w }} className="h-11 bg-[var(--card)] border border-[var(--border)] rounded-full animate-pulse shrink-0" />
        ))}
      </div>

      <div className="flex-1 px-4 sm:px-6 flex flex-col gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-[var(--card)] rounded-2xl p-3">
            <div className="w-14 h-14 rounded-xl bg-[var(--border)] animate-pulse shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-3.5 w-3/4 bg-[var(--border)] rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-[var(--border)] rounded animate-pulse" />
            </div>
            <div className="h-3 w-10 bg-[var(--border)] rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>

      <div className="ui-bottom-spacer" />
    </div>
  )
}
