import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import {
  investorSessionForbiddenResponse,
  requireMarketplacePurchaseSession
} from '../../../../lib/onboarding/requireInvestorSession';
import { getCartBatchStatus } from '../../../../lib/payments/cartCheckoutService';
import {
  deriveSettlementPhase,
  scanAwaitingTreasuryUsdcSettlements
} from '../../../../lib/payments/postPaymentSettlementOrchestrator';
import { scanTreasuryForPendingUsdcDeposit } from '../../../../lib/payments/platformWalletService';

export const dynamic = 'force-dynamic';

/**
 * Unified settlement status for simplified checkout (deposit or cart purchase).
 * Optional sync=1 triggers USDC watchers before reading status.
 */
export async function GET(request: Request) {
  const ctx = await requireMarketplacePurchaseSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const url = new URL(request.url);
  const referenceId = url.searchParams.get('referenceId')?.trim();
  const mode = url.searchParams.get('mode')?.trim() === 'purchase' ? 'purchase' : 'deposit';
  const sync = url.searchParams.get('sync') === '1';

  if (!referenceId) {
    return NextResponse.json({ error: 'REFERENCE_REQUIRED' }, { status: 400 });
  }

  if (sync) {
    try {
      if (mode === 'deposit') {
        await scanTreasuryForPendingUsdcDeposit(referenceId);
      }
      await scanAwaitingTreasuryUsdcSettlements();
    } catch (error) {
      console.error('[checkout/settlement-status] sync', error);
    }
  }

  if (mode === 'deposit') {
    const deposit = await prisma.platformDeposit.findFirst({
      where: { id: referenceId, userId: ctx.userId }
    });
    if (!deposit) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const metadata = (deposit.metadata as Record<string, unknown>) ?? {};
    const phase = deriveSettlementPhase({
      kind: 'deposit',
      depositStatus: deposit.status,
      depositMetadata: metadata
    });
    return NextResponse.json({
      mode: 'deposit',
      referenceId,
      phase,
      status: deposit.status,
      metadata
    });
  }

  const cart = await getCartBatchStatus(ctx.userId, referenceId, { sync: false });
  const phase = deriveSettlementPhase({
    kind: 'cart',
    cartAllConfirmed: cart.allConfirmed,
    cartIntents: cart.paymentIntents.map((row) => ({
      status: row.status,
      metadata: (row.metadata ?? {}) as Record<string, unknown>
    }))
  });

  return NextResponse.json({
    mode: 'purchase',
    referenceId,
    phase,
    status: cart,
    allConfirmed: cart.allConfirmed
  });
}
