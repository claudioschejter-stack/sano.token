export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-6 md:space-y-8">
      <div className="space-y-3 border-b border-terminal-border pb-6">
        <div className="h-3 w-40 rounded bg-terminal-border" />
        <div className="h-10 w-96 max-w-full rounded bg-terminal-border" />
        <div className="h-4 w-full max-w-xl rounded bg-terminal-border" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 rounded-xl border border-terminal-border bg-terminal-card sm:h-40" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-xl border border-terminal-border bg-terminal-card lg:h-96" />
        <div className="h-72 rounded-xl border border-terminal-border bg-terminal-card lg:h-96" />
      </div>
      <div className="h-64 rounded-xl border border-terminal-border bg-terminal-card md:h-96" />
    </div>
  );
}
