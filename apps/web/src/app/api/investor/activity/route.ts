import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../lib/onboarding/requireInvestorSession';
import { getInvestorActivityLedger } from '../../../../lib/investor/investorActivityLedger';

export const dynamic = 'force-dynamic';

/** Unified investor activity ledger (deposits, withdrawals, dividends, purchases). */
export async function GET(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;

  try {
    const items = await getInvestorActivityLedger(ctx.userId, { limit });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error('[api/investor/activity]', error);
    return NextResponse.json({ error: 'ACTIVITY_LEDGER_FAILED' }, { status: 500 });
  }
}
