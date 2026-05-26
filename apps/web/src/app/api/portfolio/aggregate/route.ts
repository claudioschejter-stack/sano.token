import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import {
  aggregatePortfolioForUser,
  recordPortfolioSnapshot
} from '../../../../lib/portfolio/portfolioAggregator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const shouldSnapshot = new URL(request.url).searchParams.get('snapshot') === 'true';
  if (shouldSnapshot) {
    await recordPortfolioSnapshot(ctx.userId);
  }

  const portfolio = await aggregatePortfolioForUser(ctx.userId);
  return NextResponse.json({ ok: true, portfolio });
}
