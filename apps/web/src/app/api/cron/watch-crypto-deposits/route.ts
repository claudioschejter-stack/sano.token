import { NextResponse } from 'next/server';
import { isCronRequestAllowed } from '../../../../lib/cron/authorizeCronRequest';
import { scanAllPendingCryptoQrDeposits } from '../../../../lib/payments/platformWalletService';
import { autoSettleAllReadyPrivyCarts } from '../../../../lib/payments/privyAutoSettleService';
import { scanAllPrivyInboundWallets } from '../../../../lib/payments/privyInboundUsdcService';
import { scanAwaitingTreasuryUsdcSettlements } from '../../../../lib/payments/postPaymentSettlementOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type StageResult = { ok: true; data: unknown } | { ok: false; error: string };

/**
 * Run one sweep stage in isolation.
 * A single broken scan used to abort the whole sweep and return an opaque 500,
 * so a misconfigured RPC silently stopped treasury settlements too.
 */
async function runStage(name: string, run: () => Promise<unknown>): Promise<StageResult> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron/watch-crypto-deposits] ${name} failed`, error);
    return { ok: false, error: message.slice(0, 300) };
  }
}

/**
 * Safety-net sweep:
 * - USDC inbound to investor Privy wallets (personal receive address)
 * - server-side Privy → treasury → share delivery (no client Privy login)
 * - pending USDC-on-chain QR deposits (legacy treasury path)
 * - MANUAL_REVIEW fiat rails awaiting USDC on Base treasury
 */
export async function GET(request: Request) {
  if (!(await isCronRequestAllowed(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stages: Record<string, StageResult> = {};

  stages.privyInbound = await runStage('privyInbound', scanAllPrivyInboundWallets);
  stages.privyAutoSettle = await runStage('privyAutoSettle', autoSettleAllReadyPrivyCarts);

  const [crypto, fiat] = await Promise.all([
    runStage('cryptoQrDeposits', scanAllPendingCryptoQrDeposits),
    runStage('awaitingTreasuryUsdc', scanAwaitingTreasuryUsdcSettlements)
  ]);
  stages.crypto = crypto;
  stages.fiat = fiat;

  const failures = Object.entries(stages)
    .filter(([, result]) => !result.ok)
    .map(([name, result]) => ({ stage: name, error: (result as { error: string }).error }));

  // Partial failures stay HTTP 200 with detail: the backup workflow should only
  // go red when nothing ran, not when one scan is degraded.
  const allFailed = failures.length === Object.keys(stages).length;

  return NextResponse.json(
    {
      ok: failures.length === 0,
      degraded: failures.length > 0 && !allFailed,
      failures,
      stages
    },
    { status: allFailed ? 500 : 200 }
  );
}
