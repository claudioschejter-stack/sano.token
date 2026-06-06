import { MarketplaceView } from '../../../components/marketplace/MarketplaceView';
import { fetchMarketplaceFeed } from '../../../lib/marketplace/marketplaceFeedServer';

export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  const initialFeed = await fetchMarketplaceFeed();

  return <MarketplaceView initialFeed={initialFeed} />;
}
