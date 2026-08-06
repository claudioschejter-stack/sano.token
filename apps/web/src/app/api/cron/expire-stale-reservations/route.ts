import { NextResponse } from 'next/server';
import { isCronRequestAllowed } from '../../../../lib/cron/authorizeCronRequest';
import { expireStaleCartReservations } from '../../../../lib/payments/closeStaleCartBatches';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Hourly sweep: return tokens reserved by unpaid checkouts to the marketplace.
 * Reservations expire after `PAYMENT_ORDER_TTL_MINUTES` (default 30), but the
 * daily maintenance cron used to be the only thing releasing them.
 */
export async function GET(request: Request) {
  if (!(await isCronRequestAllowed(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await expireStaleCartReservations();
    return NextResponse.json({
      ok: true,
      expired: result.expiredIntentIds.length,
      releasedTokens: result.releasedTokens
    });
  } catch (error) {
    console.error('[cron/expire-stale-reservations]', error);
    return NextResponse.json({ error: 'EXPIRE_FAILED' }, { status: 500 });
  }
}
