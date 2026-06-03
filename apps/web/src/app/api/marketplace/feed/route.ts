import { NextResponse } from 'next/server';
import { fetchMarketplaceFeedFromDb } from '../../../../lib/marketplace/marketplaceFeedService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const feed = await fetchMarketplaceFeedFromDb();
    return NextResponse.json(feed);
  } catch (error) {
    console.error('[marketplace/feed]', error);
    return NextResponse.json({ error: 'Failed to load marketplace feed' }, { status: 500 });
  }
}
