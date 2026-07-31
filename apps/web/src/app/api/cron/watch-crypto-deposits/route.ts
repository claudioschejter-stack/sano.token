import { NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';
import { scanAllPendingCryptoQrDeposits } from '../../../../lib/payments/platformWalletService';
import { scanAllPrivyInboundWallets } from '../../../../lib/payments/privyInboundUsdcService';
import { scanAwaitingTreasuryUsdcSettlements } from '../../../../lib/payments/postPaymentSettlementOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Safety-net sweep:
 * - USDC inbound to investor Privy wallets (personal receive address)
 * - pending USDC-on-chain QR deposits (legacy treasury path)
 * - MANUAL_REVIEW fiat rails awaiting USDC on Base treasury
 *
 * Note: Privy → treasury auto-settle still requires the investor session (client
 * signs). The cron only detects inbound + marks carts readyToAutoSettle.
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [privyInbound, crypto, fiat] = await Promise.all([
      scanAllPrivyInboundWallets(),
      scanAllPendingCryptoQrDeposits(),
      scanAwaitingTreasuryUsdcSettlements()
    ]);
    return NextResponse.json({ ok: true, privyInbound, crypto, fiat });
  } catch (error) {
    console.error('[cron/watch-crypto-deposits]', error);
    return NextResponse.json({ error: 'WATCH_SWEEP_FAILED' }, { status: 500 });
  }
}
