'use client';

import { Suspense } from 'react';
import { InvestorCollectionWalletPanel } from './InvestorCollectionWalletPanel';

function InvestorCollectionWalletPanelFallback() {
  return (
    <div className="h-48 animate-pulse rounded-xl border border-terminal-border bg-terminal-card" />
  );
}

/** Standalone page wrapper; prefer embedding via FinancialOverview. */
export function InvestorCollectionWalletView() {
  return (
    <section className="mx-auto max-w-3xl">
      <Suspense fallback={<InvestorCollectionWalletPanelFallback />}>
        <InvestorCollectionWalletPanel />
      </Suspense>
    </section>
  );
}
