import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';

export const dynamic = 'force-dynamic';

export async function POST() {
  const ctx = await requireInvestorSession({ operational: true });

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  return NextResponse.json(
    {
      error: 'MORPHO_REPAY_ON_CHAIN',
      message: 'Use Morpho on-chain repay from Cash Flow (/dashboard/cash-flow).'
    },
    { status: 410 }
  );
}
