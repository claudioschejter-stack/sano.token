import type { MarketplaceListing } from './marketplace';

export type SecondaryMarketOrder = {
  id: string;
  projectId: string;
  sellerUserId: string;
  sellerName: string | null;
  tokenCount: number;
  pricePerTokenUsd: number;
  totalUsd: number;
  createdAt: string;
  isOwnListing: boolean;
};

export type SecondaryMarketPlatformBuyback = {
  id: string;
  projectId: string;
  pricePerTokenUsd: number;
  referencePriceUsd: number;
  discountPercent: number;
  label: string;
};

export type SecondaryMarketProperty = {
  listing: MarketplaceListing;
  orders: SecondaryMarketOrder[];
  platformBuyback: SecondaryMarketPlatformBuyback;
  totalTokensForSale: number;
  lowestAskUsd: number | null;
};

export type SecondaryMarketFeed = {
  properties: SecondaryMarketProperty[];
  cachedAt: string;
};

export type SecondaryMarketHolding = {
  projectId: string;
  ownedTokens: number;
  listedTokens: number;
  availableToSell: number;
};
