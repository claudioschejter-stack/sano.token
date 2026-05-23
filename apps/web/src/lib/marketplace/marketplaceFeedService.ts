import { fetchBestBorrowRate } from '../lending/bestBorrowRate';
import { listMarketplaceListings } from '../admin/assetsService';
import type { MarketplaceFeed } from '../../types/marketplace';

export async function fetchMarketplaceFeedFromDb(): Promise<MarketplaceFeed> {
  const listings = await listMarketplaceListings();
  const borrowRate = await fetchBestBorrowRate().catch(() => null);

  return {
    listings,
    borrowRate,
    cachedAt: new Date().toISOString(),
    dataSource: listings.length > 0 ? 'live' : 'empty',
    usedFallback: false
  };
}
