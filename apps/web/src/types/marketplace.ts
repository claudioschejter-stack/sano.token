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
  tokenInstrumentType: 'DEBT' | 'EQUITY';
  maturityDate?: string | null;
  equitySharePercent?: number | null;
  fiscalRegime: string;
  jurisdiction: string | null;
  tokenSymbol?: string | null;
  tokenName?: string | null;
  mediaGallery?: Array<{ type: 'image' | 'reel'; url: string; caption?: string }>;
  contracts?: {
    trust?: string | null;
    purchase?: string | null;
    lease?: string | null;
    smartContract?: string | null;
  };
};

export type BorrowRateQuote = {
  id: string;
  name: string;
  protocol: string;
  borrowApyBps: number;
  region: 'global' | 'americas' | 'europe' | 'asia_pacific' | 'mea';
  category: 'money_market' | 'credit_pool' | 'rwa' | 'institutional';
  source?: string;
  fetchedAt?: string;
};

export type BestBorrowRateResponse = {
  best: BorrowRateQuote & {
    source: string;
    fetchedAt: string;
  };
  quotes: BorrowRateQuote[];
  meta?: {
    liveCount: number;
    totalCount: number;
    dataSource: 'live' | 'fallback';
  };
};

export type MarketplaceFeed = {
  listings: MarketplaceListing[];
  borrowRate: BestBorrowRateResponse | null;
  cachedAt: string;
  dataSource: 'live' | 'empty' | 'fallback';
  usedFallback?: boolean;
};
