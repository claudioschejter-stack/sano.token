import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getSecondaryMarketFeed } from '../../../../lib/secondaryMarket/secondaryMarketService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const viewerUserId = session?.user?.id;

  try {
    const feed = await getSecondaryMarketFeed(viewerUserId);
    return NextResponse.json(feed);
  } catch (error) {
    console.error('[secondary-market/feed GET]', error);
    return NextResponse.json({ error: 'Failed to load secondary market' }, { status: 500 });
  }
}
