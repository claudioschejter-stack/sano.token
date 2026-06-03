import { MARKETPLACE_FALLBACK_LISTINGS } from '../../data/marketplaceFallback';
import type { MarketplaceListing } from '../../types/marketplace';
import { splitMarketplaceListings } from './splitMarketplaceListings';

export function pickFeaturedListings(
  listings: MarketplaceListing[],
  limit = 6
): MarketplaceListing[] {
  const source = listings.length > 0 ? listings : MARKETPLACE_FALLBACK_LISTINGS;
  const { available, sold } = splitMarketplaceListings(source);
  const featured = [...available];

  if (featured.length < limit) {
    featured.push(...sold.slice(0, limit - featured.length));
  }

  return featured.slice(0, limit);
}
