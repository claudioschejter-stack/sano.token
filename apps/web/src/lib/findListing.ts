import { MARKETPLACE_FALLBACK_LISTINGS } from '../data/marketplaceFallback';
import { allowDemoContent } from './runtime/environment';
import type { MarketplaceListing } from '../types/marketplace';

export function findListingById(
  projectId: string,
  listings: MarketplaceListing[]
): MarketplaceListing | undefined {
  const fromFeed = listings.find((row) => row.id === projectId);
  if (fromFeed) {
    return fromFeed;
  }

  if (!allowDemoContent()) {
    return undefined;
  }

  return MARKETPLACE_FALLBACK_LISTINGS.find((row) => row.id === projectId);
}
