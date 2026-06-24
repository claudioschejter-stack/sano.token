import { NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';
import {
  runAutoRentDistribution,
  getTreasuryUsdcBalanceUsd
} from '../../../../lib/yield/autoRentDistributionService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron — auto-detect new USDC at treasury wallet and distribute to investors.
 *
 * Flow:
 *   1. Read USDC balance at BASE_STABLECOIN_TREASURY_ADDRESS on Base network.
 *   2. Skip if below RENT_AUTO_DISTRIBUTE_MIN_USD threshold (default $500).
 *   3. Skip if there are already pending operating credits (prevents double-distribution).
 *   4. Split balance pro-rata across active projects by investor token count.
 *   5. Credit and distribute each share via creditAndDistributeOperatingRent.
 *
 * Schedule: daily at 10:00 UTC (after tenant payment window).
 * Env vars required:
 *   - BASE_STABLECOIN_TREASURY_ADDRESS  → wallet that receives USDC from tenants
 *   - BASE_USDC_TOKEN_ADDRESS           → USDC contract on Base (default: mainnet address)
 *   - BASE_RPC_URL or LENDING_BASE_RPC_URL
 *   - RENT_AUTO_DISTRIBUTE_MIN_USD      → minimum threshold in USD (default: 500)
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Always report current treasury balance for observability
    const currentBalanceUsd = await getTreasuryUsdcBalanceUsd().catch(() => null);

    const result = await runAutoRentDistribution();

    return NextResponse.json({
      ok: true,
      treasuryBalanceUsd: currentBalanceUsd,
      ...result,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[cron/auto-distribute-rent]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Distribution cron failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
