import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getStablecoinNetwork } from '../../../../lib/payments/stablecoinNetworks';
import { ingestInboundUsdcTransfer } from '../../../../lib/payments/privyInboundUsdcService';
import { autoSettlePrivyCartForUser } from '../../../../lib/payments/privyAutoSettleService';
import { scanAwaitingTreasuryUsdcSettlements } from '../../../../lib/payments/postPaymentSettlementOrchestrator';
import { safeLogId } from '../../../../lib/logging/safeLogValue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * USDC arriving in an investor's wallet, told to us instead of discovered.
 *
 * The scan reads a window of recent blocks. A deposit older than the window is
 * invisible until somebody goes looking, so if the cron did not run and the
 * investor did not have the page open, their money arrived and the platform
 * never noticed. This removes the window: Alchemy notifies the transfer, and the
 * only reads left are the ones that confirm it.
 *
 * Configure an Address Activity webhook on Base for the investor wallets, with
 * `ALCHEMY_WEBHOOK_SIGNING_KEY` set to the key Alchemy shows for it.
 */

type AlchemyActivity = {
  fromAddress?: string;
  toAddress?: string;
  value?: number;
  asset?: string;
  hash?: string;
  blockNum?: string;
  category?: string;
  rawContract?: { address?: string; decimals?: number };
};

type AlchemyPayload = {
  type?: string;
  event?: { network?: string; activity?: AlchemyActivity[] };
};

/**
 * Alchemy signs the raw body with the webhook's own key. Comparing in constant
 * time matters: a fast reject leaks how much of the signature was right.
 */
function signatureValid(rawBody: string, signature: string | null): boolean {
  const key = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY?.trim();
  if (!key || !signature) {
    return false;
  }

  const expected = createHmac('sha256', key).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.trim(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!signatureValid(rawBody, request.headers.get('x-alchemy-signature'))) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  let payload: AlchemyPayload;
  try {
    payload = JSON.parse(rawBody) as AlchemyPayload;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const network = getStablecoinNetwork('BASE');
  const usdc = network.tokenAddress?.toLowerCase();
  const treasury = network.treasuryAddress?.toLowerCase() ?? null;
  const activity = payload.event?.activity ?? [];
  const results: Array<{ txHash: string; recorded: boolean; reason?: string }> = [];
  const settled = new Set<string>();
  let treasuryInflow = false;

  for (const row of activity) {
    // Only USDC, and only the token contract we settle in.
    const contract = row.rawContract?.address?.toLowerCase();
    if (!row.hash || !row.toAddress || !row.value || (usdc && contract !== usdc)) {
      continue;
    }

    /**
     * USDC reaching the treasury is a fiat payment completing its second half:
     * Macro or Ripio collected pesos, converted, and sent it here. That used to
     * be discovered by a daily cron, so a payment made in the morning could take
     * until the next day to confirm — with the investor's tokens waiting.
     */
    if (treasury && row.toAddress.toLowerCase() === treasury) {
      treasuryInflow = true;
      results.push({ txHash: row.hash, recorded: false, reason: 'TREASURY_INFLOW' });
      continue;
    }

    const outcome = await ingestInboundUsdcTransfer({
      toAddress: row.toAddress,
      fromAddress: row.fromAddress ?? '',
      amountUsd: row.value,
      txHash: row.hash,
      blockNumber: row.blockNum ? Number.parseInt(row.blockNum, 16) || 0 : 0
    }).catch((error) => {
      console.error('[webhooks/alchemy] ingest failed', safeLogId(row.hash), error);
      return { recorded: false, userId: null, reason: 'INGEST_FAILED' as const };
    });

    results.push({ txHash: row.hash, recorded: outcome.recorded, reason: outcome.reason });

    /**
     * The point of hearing about the money immediately is acting on it
     * immediately: if this deposit completes a pending cart, settle it now
     * rather than on the next poll.
     */
    if (outcome.recorded && outcome.userId && !settled.has(outcome.userId)) {
      settled.add(outcome.userId);
      await autoSettlePrivyCartForUser(outcome.userId).catch((error) => {
        console.error('[webhooks/alchemy] auto-settle failed', safeLogId(outcome.userId), error);
      });
    }
  }

  /**
   * Run the sweep once for the whole batch, not once per transfer: it matches
   * every payment waiting on treasury USDC, so calling it repeatedly would do
   * the same work again.
   */
  let treasurySettled: unknown = null;
  if (treasuryInflow) {
    treasurySettled = await scanAwaitingTreasuryUsdcSettlements().catch((error) => {
      console.error('[webhooks/alchemy] treasury sweep failed', error);
      return null;
    });
  }

  return NextResponse.json({
    ok: true,
    received: activity.length,
    recorded: results.filter((row) => row.recorded).length,
    treasurySettled,
    results
  });
}
