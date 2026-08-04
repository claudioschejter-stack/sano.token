import { buildFallbackFeed } from '../marketplaceApi';
import { fetchMarketplaceFeedFromDb } from './marketplaceFeedService';
import { runThrottledReservationSweep } from '../payments/throttledReservationSweep';
import type { MarketplaceFeed } from '../../types/marketplace';

/** Server-only marketplace SSR feed (DB + optional Redis). */
export async function fetchMarketplaceFeed(): Promise<MarketplaceFeed> {
  /**
   * An abandoned cart holds its tokens out of stock, and the daily cron is the
   * only other thing that releases them, so supply could read as sold out for
   * hours. Sweeping here — throttled and fire-and-forget — means the listing
   * that shows availability is also what keeps it honest.
   */
  runThrottledReservationSweep();

  try {
    return await fetchMarketplaceFeedFromDb();
  } catch {
    return buildFallbackFeed();
  }
}
