import { NextResponse } from 'next/server';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../../lib/onboarding/requireInvestorSession';
import { scanTreasuryForPendingUsdcDeposit } from '../../../../../lib/payments/platformWalletService';
import { prisma } from '@sanova/database';

export const dynamic = 'force-dynamic';

/**
 * Lightweight polling endpoint used by CryptoWalletPanel while a QR-based crypto
 * deposit is pending: scans the treasury for a matching on-chain USDC transfer and
 * auto-confirms it, so the user never has to paste a transaction hash.
 */
export async function GET(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const depositId = new URL(request.url).searchParams.get('id')?.trim();
  if (!depositId) {
    return NextResponse.json({ error: 'DEPOSIT_ID_REQUIRED' }, { status: 400 });
  }

  const owned = await prisma.platformDeposit.findFirst({
    where: { id: depositId, userId: ctx.userId },
    select: { id: true }
  });
  if (!owned) {
    return NextResponse.json({ error: 'DEPOSIT_NOT_FOUND' }, { status: 404 });
  }

  try {
    const deposit = await scanTreasuryForPendingUsdcDeposit(depositId);
    return NextResponse.json({ ok: true, deposit });
  } catch (error) {
    console.error('[wallet/deposit-intents/watch]', error);
    return NextResponse.json({ error: 'DEPOSIT_WATCH_FAILED' }, { status: 500 });
  }
}
