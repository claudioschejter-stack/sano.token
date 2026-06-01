import { Suspense } from 'react';
import { SecondaryMarketView } from '../../../components/secondaryMarket/SecondaryMarketView';
import { getSecondaryMarketFeed } from '../../../lib/secondaryMarket/secondaryMarketService';

export const dynamic = 'force-dynamic';

export default async function SecondaryMarketPage() {
  const initialFeed = await getSecondaryMarketFeed();

  return (
    <Suspense fallback={null}>
      <SecondaryMarketView initialFeed={initialFeed} />
    </Suspense>
  );
}
