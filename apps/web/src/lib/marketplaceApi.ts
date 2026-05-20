import { MARKETPLACE_FALLBACK_LISTINGS } from '../data/marketplaceFallback';
import type { MarketplaceFeed } from '../types/marketplace';

const REVALIDATE_SECONDS = 30;

function apiBaseUrl() {
  if (typeof window !== 'undefined') {
    return '';
  }

  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function buildFallbackFeed(): MarketplaceFeed {
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

const API_TIMEOUT_MS = 4_000;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBaseUrl()}/api/v1${path}`, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Marketplace API error: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Server-side fetch with ISR cache (marketplace SSR). */
export async function fetchMarketplaceFeed(): Promise<MarketplaceFeed> {
  try {
    const payload = await fetchJson<Omit<MarketplaceFeed, 'usedFallback'>>('/marketplace/feed', {
      next: { revalidate: REVALIDATE_SECONDS }
    });

    if (payload.listings.length === 0) {
      return buildFallbackFeed();
    }

    return {
      ...payload,
      dataSource: payload.dataSource === 'live' ? 'live' : 'fallback',
      usedFallback: false
    };
  } catch {
    return buildFallbackFeed();
  }
}

/** Client-side refresh after hydration. */
export function fetchMarketplaceFeedClient() {
  return fetchJson<MarketplaceFeed>('/marketplace/feed', { cache: 'no-store' });
}
