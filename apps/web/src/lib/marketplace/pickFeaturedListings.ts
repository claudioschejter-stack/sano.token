import { MARKETPLACE_FALLBACK_LISTINGS } from '../../data/marketplaceFallback';
import type { MarketplaceListing } from '../../types/marketplace';

export function pickFeaturedListings(
  listings: MarketplaceListing[],
  limit = 6
): MarketplaceListing[] {
  const source = listings.length > 0 ? listings : MARKETPLACE_FALLBACK_LISTINGS;

  return [...source].sort((a, b) => a.soldPercent - b.soldPercent).slice(0, limit);
}
