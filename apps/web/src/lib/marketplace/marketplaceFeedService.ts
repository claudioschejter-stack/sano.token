import { unstable_cache } from 'next/cache';
import { fetchBestBorrowRate } from '../lending/bestBorrowRate';
import { listMarketplaceListings } from '../admin/assetsService';
import type { MarketplaceFeed } from '../../types/marketplace';

function feedCacheTtlSeconds(): number {
  const parsed = Number.parseInt(process.env.MARKETPLACE_FEED_CACHE_TTL ?? '30', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 30;
}

const getCachedMarketplaceListings = unstable_cache(
  async () => listMarketplaceListings({ skipHeavySync: true }),
  ['marketplace-listings-feed'],
  {
    revalidate: feedCacheTtlSeconds(),
    tags: ['marketplace-feed']
  }
);

export async function fetchMarketplaceFeedFromDb(): Promise<MarketplaceFeed> {
  const [listings, borrowRate] = await Promise.all([
    getCachedMarketplaceListings(),
    fetchBestBorrowRate().catch(() => null)
  ]);

  return {
    listings,
    borrowRate,
    cachedAt: new Date().toISOString(),
    dataSource: listings.length > 0 ? 'live' : 'empty',
    usedFallback: false
  };
}
