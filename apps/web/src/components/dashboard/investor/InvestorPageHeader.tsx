import type { ReactNode } from "react";

type InvestorPageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function InvestorPageHeader({ eyebrow, title, subtitle, action }: InvestorPageHeaderProps) {
  return (
    <header className="border-b border-terminal-border pb-5 md:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-terminal-text sm:text-3xl md:text-4xl">{title}</h1>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-sm text-terminal-muted md:mt-3 md:text-base">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
    </header>
  );
}
