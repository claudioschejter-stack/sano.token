import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { scanPrivyInboundForUser } from '../../../../../lib/payments/privyInboundUsdcService';

export const dynamic = 'force-dynamic';

/** Lightweight poller for checkout / Mi Cartera while waiting for Ripio→Privy USDC. */
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
    // `address` is always the canonical server-linked receive wallet after
    // reconcile — clients must not substitute a Privy SDK address for copy/QR.
    return NextResponse.json({
      ok: true,
      address: result.address,
      canonical: true,
      balanceUsdc: result.balanceUsdc,
      balanceKnown: result.balanceKnown,
      newInbounds: result.newInbounds,
      pendingPurchase: result.pendingPurchase,
      readyToAutoSettle: result.readyToAutoSettle
    });
  } catch (error) {
    console.error('[wallet/privy-inbound/watch]', error);
    return NextResponse.json({ error: 'PRIVY_INBOUND_WATCH_FAILED' }, { status: 500 });
  }
}
