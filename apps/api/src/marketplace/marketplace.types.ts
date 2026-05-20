import type { BestBorrowRateResult } from '../lending/lending.types';

export type MarketplaceListingDto = {
  id: string;
  title: string;
  description: string;
  location: string;
  imageUrl: string;
  mapEmbedUrl: string;
  apyPercent: number;
  pricePerTokenUsd: number;
  availableTokens: number;
  totalTokens: number;
  soldPercent: number;
  fiscalRegime: string;
  jurisdiction: string | null;
};

export type MarketplaceFeedDto = {
  listings: MarketplaceListingDto[];
  borrowRate: BestBorrowRateResult | null;
  cachedAt: string;
  dataSource: 'live' | 'empty';
};
