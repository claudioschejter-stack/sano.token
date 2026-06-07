'use client';

import type { ReactNode } from 'react';

type StickyActionBarProps = {
  children: ReactNode;
  /** Optional summary line above the primary action (e.g. total amount). */
  summary?: ReactNode;
  className?: string;
};

/** Fixed bottom CTA bar for mobile checkout and long forms. */
export function StickyActionBar({ children, summary, className = '' }: StickyActionBarProps) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-terminal-border bg-terminal-card/95 backdrop-blur-md md:hidden ${className}`}
    >
      <div className="safe-x mx-auto max-w-2xl space-y-2 px-4 pb-safe pt-3">
        {summary}
        {children}
      </div>
    </div>
  );
}
