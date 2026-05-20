export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-8">
      <div className="space-y-3 border-b border-terminal-border pb-6">
        <div className="h-3 w-40 rounded bg-terminal-border" />
        <div className="h-10 w-96 max-w-full rounded bg-terminal-border" />
        <div className="h-4 w-full max-w-xl rounded bg-terminal-border" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-40 rounded-xl border border-terminal-border bg-terminal-card" />
        ))}
      </div>
      <div className="h-96 rounded-xl border border-terminal-border bg-terminal-card" />
    </div>
  );
}
