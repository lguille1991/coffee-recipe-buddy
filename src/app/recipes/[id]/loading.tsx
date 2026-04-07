export default function RecipeDetailLoading() {
  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pb-4 flex items-center justify-between">
        <div className="h-6 w-6 bg-[var(--border)] rounded animate-pulse" />
        <div className="h-5 w-24 bg-[var(--border)] rounded animate-pulse" />
        <div className="h-6 w-6 bg-[var(--border)] rounded animate-pulse" />
      </div>

      {/* Bean image placeholder */}
      <div className="px-6 mb-4">
        <div className="w-full aspect-[4/3] rounded-[16px] bg-[var(--border)] animate-pulse" />
      </div>

      {/* Bean info */}
      <div className="px-6 mb-6 flex flex-col gap-2">
        <div className="h-6 w-2/3 bg-[var(--border)] rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-[var(--border)] rounded animate-pulse" />
        <div className="h-4 w-1/3 bg-[var(--border)] rounded animate-pulse" />
      </div>

      {/* Parameters */}
      <div className="px-6 mb-4 grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[var(--card)] rounded-2xl p-3 flex flex-col gap-1.5">
            <div className="h-3 w-10 bg-[var(--border)] rounded animate-pulse" />
            <div className="h-5 w-12 bg-[var(--border)] rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="px-6 flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-[var(--card)] rounded-2xl p-3 flex gap-3 items-start">
            <div className="w-5 h-5 rounded-full bg-[var(--border)] animate-pulse shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-3.5 w-1/4 bg-[var(--border)] rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-[var(--border)] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      <div className="h-24" />
    </div>
  )
}
