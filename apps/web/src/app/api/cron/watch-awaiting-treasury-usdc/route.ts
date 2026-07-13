import { NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';
import { scanAwaitingTreasuryUsdcSettlements } from '../../../../lib/payments/postPaymentSettlementOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Dedicated sweep for fiat rails waiting on USDC Base treasury settlement. */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await scanAwaitingTreasuryUsdcSettlements();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/watch-awaiting-treasury-usdc]', error);
    return NextResponse.json({ error: 'WATCH_SWEEP_FAILED' }, { status: 500 });
  }
}
