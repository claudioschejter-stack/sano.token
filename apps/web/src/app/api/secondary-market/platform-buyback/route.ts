import { NextResponse } from 'next/server';
import { executePlatformBuyback } from '../../../../lib/secondaryMarket/secondaryMarketService';
import { requireInvestorOperationalSession } from '../../../../lib/onboarding/requireOperationalSession';

export async function POST(request: Request) {
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

  const body = (await request.json()) as { projectId?: string; tokenCount?: number };

  if (!body.projectId || !Number.isInteger(body.tokenCount) || (body.tokenCount ?? 0) <= 0) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  try {
    const result = await executePlatformBuyback({
      userId: ctx.userId,
      projectId: body.projectId,
      tokenCount: body.tokenCount ?? 0
    });

    return NextResponse.json({ ok: true, buyback: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'INSUFFICIENT_TOKENS' ||
      message === 'INVALID_TOKEN_COUNT' ||
      message === 'PROJECT_NOT_AVAILABLE'
        ? 400
        : 500;

    console.error('[secondary-market/platform-buyback POST]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
