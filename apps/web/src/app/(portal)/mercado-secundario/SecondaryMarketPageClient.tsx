'use client';

import { Suspense } from 'react';
import { SecondaryMarketView } from '../../../components/secondaryMarket/SecondaryMarketView';
import { PwaSecondaryMarketView } from '../../../components/pwa/PwaSecondaryMarketView';
import { useMobilePortal } from '../../../hooks/useMobilePortal';
import type { SecondaryMarketFeed } from '../../../types/secondaryMarket';

type Props = {
  initialFeed: SecondaryMarketFeed;
};

function PwaSecondaryMarketFallback() {
  return <div className="min-h-40 animate-pulse rounded-2xl bg-slate-100" />;
}

export function SecondaryMarketPageClient({ initialFeed }: Props) {
  const isMobilePortal = useMobilePortal();

  if (isMobilePortal) {
    return (
      <Suspense fallback={<PwaSecondaryMarketFallback />}>
        <PwaSecondaryMarketView initialFeed={initialFeed} />
      </Suspense>
    );
  }

  return <SecondaryMarketView initialFeed={initialFeed} />;
}
