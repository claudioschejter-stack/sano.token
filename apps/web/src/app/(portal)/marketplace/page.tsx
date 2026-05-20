import { MarketplaceView } from '../../../components/marketplace/MarketplaceView';
import { fetchMarketplaceFeed } from '../../../lib/marketplaceApi';

export const revalidate = 30;

export default async function MarketplacePage() {
  const initialFeed = await fetchMarketplaceFeed();

  return <MarketplaceView initialFeed={initialFeed} />;
}
