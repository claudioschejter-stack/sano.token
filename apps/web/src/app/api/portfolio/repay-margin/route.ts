import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { repayMarginWithAvailableCash } from '../../../../lib/investor/investorService';

export async function POST() {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const result = await repayMarginWithAvailableCash(ctx.userId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'INVESTOR_NOT_FOUND' || message === 'NO_CASH_AVAILABLE') {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[portfolio/repay-margin POST]', error);
    return NextResponse.json({ error: 'REPAYMENT_FAILED' }, { status: 500 });
  }
}
