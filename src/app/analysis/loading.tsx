export default function AnalysisLoading() {
  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pb-6">
        <div className="h-7 w-48 bg-[var(--border)] rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-[var(--border)] rounded animate-pulse" />
      </div>

      {/* Bean image */}
      <div className="px-6 mb-6">
        <div className="w-full aspect-[4/3] rounded-[16px] bg-[var(--border)] animate-pulse" />
      </div>

      {/* Fields */}
      <div className="px-6 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[var(--card)] rounded-2xl p-4 flex flex-col gap-2">
            <div className="h-3 w-20 bg-[var(--border)] rounded animate-pulse" />
            <div className="h-5 w-3/4 bg-[var(--border)] rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="h-24" />
    </div>
  )
}
