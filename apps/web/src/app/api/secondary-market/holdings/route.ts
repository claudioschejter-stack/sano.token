import { NextResponse } from 'next/server';
import { requireInvestorOperationalSession } from '../../../../lib/onboarding/requireOperationalSession';
import { getSecondaryMarketHoldings } from '../../../../lib/secondaryMarket/secondaryMarketService';

export const dynamic = 'force-dynamic';

export async function GET() {
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

  try {
    const holdings = await getSecondaryMarketHoldings(ctx.userId);
    return NextResponse.json({ holdings });
  } catch (error) {
    console.error('[secondary-market/holdings GET]', error);
    return NextResponse.json({ error: 'Failed to load holdings' }, { status: 500 });
  }
}
