import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  runAutoRentDistribution,
  getTreasuryUsdcBalanceUsd
} from '../../../../lib/yield/autoRentDistributionService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET — Check current treasury USDC balance (useful before triggering distribution).
 * POST — Manually trigger the auto-distribution without waiting for the daily cron.
 *
 * This endpoint gives the Fiduciario full control:
 * - GET: See how much USDC is currently at the treasury address.
 * - POST: Immediately distribute whatever is available to all investors.
 *
 * The distribution logic is the same as the cron:
 *   threshold check → split by project → credit → send USDC on-chain.
 */
export async function GET(_request: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const balanceUsd = await getTreasuryUsdcBalanceUsd();
    const treasuryAddress = process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() || null;
    const minThreshold = Number(process.env.RENT_AUTO_DISTRIBUTE_MIN_USD ?? '500');

    return NextResponse.json({
      ok: true,
      treasuryAddress,
      balanceUsd,
      minThreshold,
      readyToDistribute: balanceUsd !== null && balanceUsd >= minThreshold,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[admin/rent-distribution GET]', error);
    return NextResponse.json({ error: 'BALANCE_READ_FAILED' }, { status: 500 });
  }
}

export async function POST(_request: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runAutoRentDistribution();
    return NextResponse.json({ ok: true, ...result, triggeredAt: new Date().toISOString() });
  } catch (error) {
    console.error('[admin/rent-distribution POST]', error);
    const message = error instanceof Error ? error.message : 'DISTRIBUTION_FAILED';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
