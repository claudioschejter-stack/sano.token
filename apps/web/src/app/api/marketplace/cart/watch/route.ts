import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireMarketplacePurchaseSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { scanTreasuryForPendingCartUsdcBatch } from '../../../../../lib/payments/postPaymentSettlementOrchestrator';

export const dynamic = 'force-dynamic';

/** Poll/auto-detect USDC Base payment for a cart purchase batch (crypto checkout). */
export async function GET(request: Request) {
  const ctx = await requireMarketplacePurchaseSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const batchId = new URL(request.url).searchParams.get('batchId')?.trim();
  if (!batchId) {
    return NextResponse.json({ error: 'BATCH_ID_REQUIRED' }, { status: 400 });
  }

  try {
    const result = await scanTreasuryForPendingCartUsdcBatch(ctx.userId, batchId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[cart/watch]', error);
    return NextResponse.json({ error: 'WATCH_FAILED' }, { status: 500 });
  }
}
