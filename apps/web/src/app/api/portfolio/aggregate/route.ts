import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
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
    return investorSessionForbiddenResponse(ctx);
  }

  const portfolio = await aggregatePortfolioForUser(ctx.userId);

  const shouldSnapshot = new URL(request.url).searchParams.get('snapshot') === 'true';
  if (shouldSnapshot) {
    await recordPortfolioSnapshot(ctx.userId, undefined, portfolio);
  }

  return NextResponse.json({ ok: true, portfolio });
}
