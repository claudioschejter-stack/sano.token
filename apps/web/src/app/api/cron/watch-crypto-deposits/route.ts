import { NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';
import { scanAllPendingCryptoQrDeposits } from '../../../../lib/payments/platformWalletService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Safety-net sweep for QR-based crypto deposits: the primary detection path is the
 * client-side poll in CryptoWalletPanel (every 5s while the QR is on screen), but if
 * the user closes the tab right after paying, this cron catches the payment anyway.
 * Requires a Vercel Pro plan for the 1-minute schedule (see apps/web/vercel.json).
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await scanAllPendingCryptoQrDeposits();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/watch-crypto-deposits]', error);
    return NextResponse.json({ error: 'WATCH_SWEEP_FAILED' }, { status: 500 });
  }
}
