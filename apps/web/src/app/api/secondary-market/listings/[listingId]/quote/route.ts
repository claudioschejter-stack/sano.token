import { NextResponse } from 'next/server';
import { getSecondaryListingQuote } from '../../../../../../lib/secondaryMarket/secondaryMarketService';

export async function GET(
  _request: Request,
  context: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await context.params;

  try {
    const quote = await getSecondaryListingQuote(listingId);
    return NextResponse.json({ quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ error: message }, { status: message === 'LISTING_NOT_FOUND' ? 404 : 500 });
  }
}
