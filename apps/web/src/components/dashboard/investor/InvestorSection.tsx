import type { ReactNode } from 'react';

type InvestorSectionProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function InvestorSection({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = 'p-4 sm:p-6'
}: InvestorSectionProps) {
  return (
    <section className={`overflow-hidden rounded-xl border border-terminal-border bg-terminal-card ${className}`}>
      <div className="flex flex-col gap-2 border-b border-terminal-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-4">
        <div className="min-w-0 max-w-none flex-1">
          <h2 className="text-base font-bold text-terminal-text sm:text-lg">{title}</h2>
          {subtitle ? (
            <p className="mt-1 max-w-none text-pretty text-xs leading-relaxed text-terminal-muted sm:text-sm">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
