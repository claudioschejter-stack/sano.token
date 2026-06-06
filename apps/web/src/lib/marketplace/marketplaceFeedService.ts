import { unstable_cache } from 'next/cache';
import { fetchBestBorrowRate } from '../lending/bestBorrowRate';
import { listMarketplaceListings } from '../admin/assetsService';
import {
  BORROW_RATES_CACHE_KEY,
  getOrSetCachedJson,
  MARKETPLACE_FEED_CACHE_KEY
} from '../redis/redisCache';
import type { MarketplaceFeed } from '../../types/marketplace';

function feedCacheTtlSeconds(): number {
  const parsed = Number.parseInt(process.env.MARKETPLACE_FEED_CACHE_TTL ?? '30', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 30;
}

const getCachedMarketplaceListings = unstable_cache(
  async () =>
    getOrSetCachedJson({
      key: `${MARKETPLACE_FEED_CACHE_KEY}:listings`,
      ttlEnvKey: 'MARKETPLACE_FEED_CACHE_TTL',
      fallbackTtlSeconds: 30,
      factory: () => listMarketplaceListings({ skipHeavySync: true })
    }),
  ['marketplace-listings-feed'],
  {
    revalidate: feedCacheTtlSeconds(),
    tags: ['marketplace-feed']
  }
);

export async function fetchMarketplaceFeedFromDb(): Promise<MarketplaceFeed> {
  const [listings, borrowRate] = await Promise.all([
    getCachedMarketplaceListings(),
    getOrSetCachedJson({
      key: BORROW_RATES_CACHE_KEY,
      fallbackTtlSeconds: 900,
      ttlSeconds: (() => {
        const minutes = Number.parseInt(process.env.LENDING_RATES_CACHE_TTL_MINUTES ?? '15', 10);
        return Number.isInteger(minutes) && minutes > 0 ? minutes * 60 : 900;
      })(),
      factory: () => fetchBestBorrowRate().catch(() => null)
    })
  ]);

  return {
    listings,
    borrowRate,
    cachedAt: new Date().toISOString(),
    dataSource: listings.length > 0 ? 'live' : 'empty',
    usedFallback: false
  };
}
