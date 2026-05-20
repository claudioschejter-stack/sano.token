export function MarketplaceSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-32 rounded bg-terminal-border" />
        <div className="h-10 w-72 rounded bg-terminal-border" />
        <div className="h-4 w-full max-w-lg rounded bg-terminal-border" />
      </div>
      <div className="mb-8 flex gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-8 w-36 rounded-full bg-terminal-border" />
        ))}
      </div>
      <div className="mb-8 h-24 rounded-xl border border-terminal-border bg-terminal-card" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[560px] rounded-xl border border-terminal-border bg-terminal-card" />
        ))}
      </div>
    </div>
  );
}
