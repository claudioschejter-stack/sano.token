import type { MarketplaceListing } from '../../types/marketplace';

export function splitMarketplaceListings(listings: MarketplaceListing[]) {
  const available = listings.filter((listing) => listing.availableTokens > 0);
  const sold = listings.filter((listing) => listing.availableTokens <= 0);

  return { available, sold };
}
