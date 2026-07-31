import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../lib/onboarding/requireInvestorSession';
import { scanPrivyInboundForUser } from '../../../../lib/payments/privyInboundUsdcService';

export const dynamic = 'force-dynamic';

/**
 * Investor status for the personal Privy receive address:
 * on-chain USDC balance, newly detected inbound transfers, and whether a pending
 * cart can auto-settle (Privy → treasury + mint) from the client session.
 */
export async function GET() {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const result = await scanPrivyInboundForUser(ctx.userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[wallet/privy-inbound]', error);
    return NextResponse.json({ error: 'PRIVY_INBOUND_SCAN_FAILED' }, { status: 500 });
  }
}
