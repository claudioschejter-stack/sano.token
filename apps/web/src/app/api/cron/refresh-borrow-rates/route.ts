import { NextResponse } from 'next/server';
import { refreshBorrowRatesCache } from '../../../../lib/lending/fetchLiveBorrowRates';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }

  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

/** Vercel Cron — refreshes in-memory borrow rate cache (DefiLlama + on-chain). */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const borrowRate = await refreshBorrowRatesCache();
    return NextResponse.json({
      ok: true,
      refreshedAt: borrowRate.best.fetchedAt,
      liveCount: borrowRate.meta?.liveCount ?? 0,
      best: borrowRate.best.name,
      bestApyBps: borrowRate.best.borrowApyBps
    });
  } catch (error) {
    console.error('[cron/refresh-borrow-rates]', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
