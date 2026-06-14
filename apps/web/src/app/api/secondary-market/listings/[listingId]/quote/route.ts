import { NextResponse } from 'next/server';
import { requireInvestorOperationalSession } from '../../../../../../lib/onboarding/requireOperationalSession';
import { getSecondaryListingQuote } from '../../../../../../lib/secondaryMarket/secondaryMarketService';

export async function GET(
  _request: Request,
  context: { params: Promise<{ listingId: string }> }
) {
  const ctx = await requireInvestorOperationalSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('kycRequired' in ctx) {
    return NextResponse.json({ error: 'KYC_REQUIRED' }, { status: 403 });
  }

  if ('investorRequired' in ctx || 'investorAccessDisabled' in ctx) {
    return NextResponse.json({ error: 'INVESTOR_ACCESS_NOT_ENABLED' }, { status: 403 });
  }

  const { listingId } = await context.params;

  try {
    const quote = await getSecondaryListingQuote(listingId);
    return NextResponse.json({ quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ error: message }, { status: message === 'LISTING_NOT_FOUND' ? 404 : 500 });
  }
}
