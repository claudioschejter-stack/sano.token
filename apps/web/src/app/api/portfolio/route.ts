import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../lib/onboarding/requireInvestorSession';
import {
  getPortfolioForUser,
  getPortfolioSummaryForUser
} from '../../../lib/investor/investorService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const [portfolio, summary] = await Promise.all([
      getPortfolioForUser(ctx.userId),
      getPortfolioSummaryForUser(ctx.userId)
    ]);

    return NextResponse.json({ portfolio, summary });
  } catch (error) {
    console.error('[portfolio GET]', error);
    return NextResponse.json({ error: 'Failed to load portfolio' }, { status: 500 });
  }
}
