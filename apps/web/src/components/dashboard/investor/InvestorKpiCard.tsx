import type { ReactNode } from 'react';

type InvestorKpiCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  valueClassName?: string;
  iconClassName?: string;
};

export function InvestorKpiCard({
  label,
  value,
  hint,
  icon,
  valueClassName = 'text-terminal-text',
  iconClassName = 'bg-terminal-bg text-terminal-primary'
}: InvestorKpiCardProps) {
  return (
    <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 shadow-[0_0_0_1px_rgba(31,41,55,0.5)] sm:p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-terminal-muted sm:text-sm">{label}</p>
          <p className={`mt-2 truncate font-mono text-2xl font-bold tracking-tight sm:mt-3 sm:text-3xl ${valueClassName}`}>
            {value}
          </p>
          <p className="mt-1.5 line-clamp-2 text-xs text-terminal-muted">{hint}</p>
        </div>
        <div className={`shrink-0 rounded-lg border border-terminal-border p-2.5 sm:p-3 ${iconClassName}`}>{icon}</div>
      </div>
    </article>
  );
}
