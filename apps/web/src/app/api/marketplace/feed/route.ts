import { NextResponse } from 'next/server';
import { fetchMarketplaceFeedFromDb } from '../../../../lib/marketplace/marketplaceFeedService';

export const maxDuration = 60;

function feedCacheTtlSeconds(): number {
  const parsed = Number.parseInt(process.env.MARKETPLACE_FEED_CACHE_TTL ?? '30', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 30;
}

export async function GET() {
  try {
    const feed = await fetchMarketplaceFeedFromDb();
    const ttl = feedCacheTtlSeconds();
    return NextResponse.json(feed, {
      headers: {
        'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`
      }
    });
  } catch (error) {
    console.error('[marketplace/feed]', error);
    return NextResponse.json({ error: 'Failed to load marketplace feed' }, { status: 500 });
  }
}
