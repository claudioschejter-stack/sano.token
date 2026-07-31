'use client';

import type { ReactNode } from 'react';

type StickyActionBarProps = {
  children: ReactNode;
  /** Optional summary line above the primary action (e.g. total amount). */
  summary?: ReactNode;
  className?: string;
};

/**
 * Fixed bottom CTA for mobile checkout / long forms.
 * Sits above the PWA / portal bottom nav (z-50, ~4.5rem) so the primary
 * action is never covered by Carrito / Panel tabs.
 */
export function StickyActionBar({ children, summary, className = '' }: StickyActionBarProps) {
  return (
    <div
      className={`fixed inset-x-0 z-[60] border-t border-terminal-border bg-terminal-card/95 backdrop-blur-md md:hidden ${className}`}
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="safe-x mx-auto max-w-2xl space-y-2 px-4 py-3">
        {summary}
        {children}
      </div>
    </div>
  );
}
