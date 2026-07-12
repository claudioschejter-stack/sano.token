import { Suspense } from 'react';
import { getSecondaryMarketFeed } from '../../../lib/secondaryMarket/secondaryMarketService';
import { SecondaryMarketPageClient } from './SecondaryMarketPageClient';

export const dynamic = 'force-dynamic';

export default async function SecondaryMarketPage() {
  const initialFeed = await getSecondaryMarketFeed();

  return (
    <Suspense fallback={null}>
      <SecondaryMarketPageClient initialFeed={initialFeed} />
    </Suspense>
  );
}
