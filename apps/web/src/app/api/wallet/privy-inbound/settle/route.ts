import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { autoSettlePrivyCartForUser } from '../../../../../lib/payments/privyAutoSettleService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Server-side auto-settle for crypto checkout.
 * Moves USDC Privy → treasury and confirms the cart without any Privy browser login.
 */
export async function POST() {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const result = await autoSettlePrivyCartForUser(ctx.userId);
    if (!result.ok) {
      const status = result.status === 'not_configured' ? 503 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PRIVY_AUTO_SETTLE_FAILED';
    console.error('[wallet/privy-inbound/settle]', error);
    return NextResponse.json({ ok: false, status: 'failed', error: message }, { status: 500 });
  }
}
