'use client';

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
    <article className="flex h-full flex-col rounded-xl border border-terminal-border bg-terminal-card p-4 shadow-[0_0_0_1px_rgba(31,41,55,0.5)] sm:p-5">
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="min-h-[2.5rem] text-xs font-medium leading-snug text-terminal-muted sm:text-sm">{label}</p>
          <p
            className={`mt-2 font-mono font-bold leading-tight tracking-tight ${valueClassName} text-[clamp(1rem,2.2vw,1.75rem)]`}
          >
            {value}
          </p>
          <p className="mt-2 min-h-[2rem] text-xs leading-snug text-terminal-muted">{hint}</p>
        </div>
        <div className={`shrink-0 rounded-lg border border-terminal-border p-2.5 sm:p-3 ${iconClassName}`}>{icon}</div>
      </div>
    </article>
  );
}
