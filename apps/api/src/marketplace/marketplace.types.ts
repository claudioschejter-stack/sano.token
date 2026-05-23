import type { BestBorrowRateResult } from '../lending/lending.types';

export type MarketplaceListingDto = {
  id: string;
  title: string;
  description: string;
  location: string;
  imageUrl: string;
  mapEmbedUrl: string;
  tokenInstrumentType: 'DEBT' | 'EQUITY';
  maturityDate: string | null;
  equitySharePercent: number | null;
  apyPercent: number;
  pricePerTokenUsd: number;
  availableTokens: number;
  totalTokens: number;
  soldPercent: number;
  fiscalRegime: string;
  jurisdiction: string | null;
  tokenSymbol: string | null;
  mediaGallery: Array<{ type: 'image' | 'reel'; url: string; caption?: string }>;
  contracts: {
    trust?: string | null;
    purchase?: string | null;
    lease?: string | null;
    smartContract?: string | null;
  };
};

export type MarketplaceFeedDto = {
  listings: MarketplaceListingDto[];
  borrowRate: BestBorrowRateResult | null;
  cachedAt: string;
  dataSource: 'live' | 'empty';
};
