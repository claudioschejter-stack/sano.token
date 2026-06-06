import { buildFallbackFeed } from '../marketplaceApi';
import { fetchMarketplaceFeedFromDb } from './marketplaceFeedService';
import type { MarketplaceFeed } from '../../types/marketplace';

/** Server-only marketplace SSR feed (DB + optional Redis). */
export async function fetchMarketplaceFeed(): Promise<MarketplaceFeed> {
  try {
    return await fetchMarketplaceFeedFromDb();
  } catch {
    return buildFallbackFeed();
  }
}
