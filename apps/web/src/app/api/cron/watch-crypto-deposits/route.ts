import { NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';
import { scanAllPendingCryptoQrDeposits } from '../../../../lib/payments/platformWalletService';
import { autoSettleAllReadyPrivyCarts } from '../../../../lib/payments/privyAutoSettleService';
import { scanAllPrivyInboundWallets } from '../../../../lib/payments/privyInboundUsdcService';
import { scanAwaitingTreasuryUsdcSettlements } from '../../../../lib/payments/postPaymentSettlementOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Safety-net sweep:
 * - USDC inbound to investor Privy wallets (personal receive address)
 * - server-side Privy → treasury → share delivery (no client Privy login)
 * - pending USDC-on-chain QR deposits (legacy treasury path)
 * - MANUAL_REVIEW fiat rails awaiting USDC on Base treasury
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const privyInbound = await scanAllPrivyInboundWallets();
    const privyAutoSettle = await autoSettleAllReadyPrivyCarts();
    const [crypto, fiat] = await Promise.all([
      scanAllPendingCryptoQrDeposits(),
      scanAwaitingTreasuryUsdcSettlements()
    ]);
    return NextResponse.json({ ok: true, privyInbound, privyAutoSettle, crypto, fiat });
  } catch (error) {
    console.error('[cron/watch-crypto-deposits]', error);
    return NextResponse.json({ error: 'WATCH_SWEEP_FAILED' }, { status: 500 });
  }
}
