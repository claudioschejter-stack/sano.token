import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { getCashFlowForUser } from '../../../../lib/investor/investorService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const records = await getCashFlowForUser(ctx.userId);
    return NextResponse.json({ records });
  } catch (error) {
    console.error('[portfolio/cash-flow GET]', error);
    return NextResponse.json({ error: 'Failed to load cash flow' }, { status: 500 });
  }
}
