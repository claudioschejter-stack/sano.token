import { NextResponse } from 'next/server';
import { isCronRequestAllowed } from '../../../../lib/cron/authorizeCronRequest';
import { fundMorphoUv3FromTreasury } from '../../../../lib/lending/fundMorphoUv3FromTreasury';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * One-shot / ops cron:
 * Safe treasury USDC → Morpho liquidity wallet → supply UV3 market
 * (e.g. apply the 20 USDC investor deposit so liquidity goes 500 → 520).
 *
 * Auth: Authorization: Bearer $CRON_SECRET | $CRON_EXTERNAL_SECRET
 * Optional: ?amountUsdc=20
 */
export async function GET(request: Request) {
  if (!(await isCronRequestAllowed(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const amountRaw = new URL(request.url).searchParams.get('amountUsdc');
  const amountUsdc = amountRaw ? Number(amountRaw) : 20;
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0 || amountUsdc > 1_000_000) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
  }

  try {
    const result = await fundMorphoUv3FromTreasury({ amountUsdc });
    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[cron/supply-morpho-uv3-from-treasury]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'FUND_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
