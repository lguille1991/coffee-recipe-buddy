export default function BrewModeLoading() {
  return (
    <div className="flex min-h-screen flex-col px-4 sm:px-6">
      <div className="h-12" />
      <div className="animate-pulse space-y-4 pb-52">
        <div className="h-6 w-28 rounded-full bg-[var(--card)]" />
        <div className="space-y-2">
          <div className="h-10 w-56 rounded-2xl bg-[var(--card)]" />
          <div className="h-4 w-72 rounded-full bg-[var(--card)]" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 rounded-2xl bg-[var(--card)]" />
          ))}
        </div>
        <div className="h-44 rounded-2xl bg-[var(--card)]" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 rounded-2xl bg-[var(--card)]" />
          ))}
        </div>
      </div>
    </div>
  )
}
