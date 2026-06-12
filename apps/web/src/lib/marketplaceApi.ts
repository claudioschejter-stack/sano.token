import { MARKETPLACE_FALLBACK_LISTINGS } from '../data/marketplaceFallback';
import { allowDemoContent } from './runtime/environment';
import type { MarketplaceFeed } from '../types/marketplace';

const FEED_PATH = '/api/marketplace/feed';

function feedUrl() {
  if (typeof window !== 'undefined') {
    return FEED_PATH;
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  return `${origin}${FEED_PATH}`;
}

export function buildEmptyMarketplaceFeed(): MarketplaceFeed {
  return {
    listings: [],
    borrowRate: null,
    cachedAt: new Date().toISOString(),
    dataSource: 'empty',
    usedFallback: false
  };
}

export function buildFallbackFeed(): MarketplaceFeed {
  if (!allowDemoContent()) {
    return buildEmptyMarketplaceFeed();
  }

  return {
    listings: MARKETPLACE_FALLBACK_LISTINGS.map((listing) => ({
      ...listing,
      soldPercent: Math.round(
        ((listing.totalTokens - listing.availableTokens) / listing.totalTokens) * 100
      )
    })),
    borrowRate: null,
    cachedAt: new Date().toISOString(),
    dataSource: 'fallback',
    usedFallback: true
  };
}

const API_TIMEOUT_MS = 20_000;

async function fetchFeed(init?: RequestInit): Promise<MarketplaceFeed> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(feedUrl(), {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Marketplace feed error: ${response.status}`);
    }

    return (await response.json()) as MarketplaceFeed;
  } finally {
    clearTimeout(timeout);
  }
}

/** Client-side refresh after hydration. */
export function fetchMarketplaceFeedClient() {
  return fetchFeed({ cache: 'no-store' });
}
