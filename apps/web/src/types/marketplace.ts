export type MarketplaceListing = {
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

export type BestBorrowRateResponse = {
  best: {
    protocol: string;
    borrowApyBps: number;
    source: string;
    fetchedAt: string;
  };
  quotes: Array<{
    protocol: string;
    borrowApyBps: number;
  }>;
};

export type MarketplaceFeed = {
  listings: MarketplaceListing[];
  borrowRate: BestBorrowRateResponse | null;
  cachedAt: string;
  dataSource: 'live' | 'empty' | 'fallback';
  usedFallback?: boolean;
};
