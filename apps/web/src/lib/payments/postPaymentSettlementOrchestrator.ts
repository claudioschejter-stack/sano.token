import { prisma, type Prisma } from '@sanova/database';
import { ethers } from 'ethers';
import { settleOnRampCheckout } from './checkoutTreasurySettlement';
import {
  resolveCheckoutReferenceByPartnerOrderId,
  resolveExpectedAmountUsd,
  type ResolvedCheckoutReference
} from './checkoutReferenceResolver';
import { getStablecoinNetwork } from './stablecoinNetworks';
import { paymentMinimumConfirmations } from './paymentConfig';
import { confirmCartPurchaseBatch, loadCartBatchIntentsAnyStatus } from './cartCheckoutService';
import { confirmPlatformDeposit } from './platformWalletService';
import { createRipioOnRampCheckout } from './ripioOnRampAdapter';
import { ripioConfigured } from './ripioClient';
import { deriveSettlementPhase, type SettlementPhase } from './settlementPhase';

export type { SettlementPhase };
export { deriveSettlementPhase };

const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from,address indexed to,uint256 value)'];

/**
 * How far back to look for the USDC that completes a fiat payment.
 *
 * This was a fixed 3000 blocks. Base produces a block every two seconds, so that
 * is a hundred minutes — and the cron that uses it as the safety net runs once a
 * day. The net covered seven percent of the gap it existed to cover: if the
 * Alchemy webhook missed the transfer (address never registered, delivery
 * failed, or the webhook was recreated and lost its address list, which
 * `alchemyWebhookAddresses` warns about), the money arrived, the cron looked at
 * the wrong hundred minutes, and the investor's purchase stayed in review with
 * nothing left to find it.
 *
 * So the window is derived from how long the payment has actually been waiting.
 */
const BASE_BLOCK_SECONDS = 2;
const MIN_LOOKBACK_BLOCKS = 3000;
/** ~30 days. Past this the payment is an ops problem, not a scanning one. */
const MAX_LOOKBACK_BLOCKS = 1_296_000;
/** Slack for block-time variance and clock skew between us and the chain. */
const LOOKBACK_SAFETY_BLOCKS = 600;
/** Public Base caps `eth_getLogs` at 10k blocks; stay under it on any provider. */
const LOG_RANGE_CHUNK_BLOCKS = 9000;

export function lookbackBlocksForWait(input: {
  waitingSinceMs?: number | null;
  nowMs?: number;
}): number {
  const now = input.nowMs ?? Date.now();
  const since = input.waitingSinceMs;

  if (typeof since !== 'number' || !Number.isFinite(since) || since > now) {
    return MIN_LOOKBACK_BLOCKS;
  }

  const waitedBlocks = Math.ceil((now - since) / 1000 / BASE_BLOCK_SECONDS);
  return Math.min(
    MAX_LOOKBACK_BLOCKS,
    Math.max(MIN_LOOKBACK_BLOCKS, waitedBlocks + LOOKBACK_SAFETY_BLOCKS)
  );
}

function amountToleranceMatch(actual: bigint, expected: bigint): boolean {
  if (actual === expected) return true;
  // Allow ±1 cent of USDC (6 decimals) for FX rounding
  const tol = 10_000n;
  const diff = actual > expected ? actual - expected : expected - actual;
  return diff <= tol;
}

async function findMatchingTreasuryUsdcTransfer(
  expectedAmountUsd: number,
  options: { waitingSinceMs?: number | null } = {}
): Promise<string | null> {
  const network = getStablecoinNetwork('BASE');
  if (!network.rpcUrl || !network.tokenAddress || !network.treasuryAddress || network.kind !== 'EVM') {
    return null;
  }
  if (!Number.isFinite(expectedAmountUsd) || expectedAmountUsd <= 0) {
    return null;
  }

  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  try {
    const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
    const expectedTo = ethers.getAddress(network.treasuryAddress);
    const expectedAmount = ethers.parseUnits(expectedAmountUsd.toFixed(network.decimals), network.decimals);
    const latestBlock = await provider.getBlockNumber();
    const lookback = lookbackBlocksForWait({ waitingSinceMs: options.waitingSinceMs });
    const fromBlock = Math.max(0, latestBlock - lookback);
    const topics = [USDC_TRANSFER_TOPIC, null, ethers.zeroPadValue(expectedTo, 32)];

    // Newest chunk first, so a recent transfer is found without reading the
    // whole window.
    let toBlock = latestBlock;
    while (toBlock >= fromBlock) {
      const chunkFrom = Math.max(fromBlock, toBlock - LOG_RANGE_CHUNK_BLOCKS + 1);
      const logs = await provider.getLogs({
        address: network.tokenAddress,
        topics,
        fromBlock: chunkFrom,
        toBlock
      });

      for (const log of [...logs].reverse()) {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) continue;
        const value = parsed.args.value as bigint;
        if (!amountToleranceMatch(value, expectedAmount)) continue;

        const receipt = await provider.getTransactionReceipt(log.transactionHash);
        const confirmations = receipt ? latestBlock - receipt.blockNumber + 1 : 0;
        if (!receipt || receipt.status !== 1 || confirmations < paymentMinimumConfirmations()) {
          continue;
        }
        return log.transactionHash;
      }

      if (chunkFrom === fromBlock) break;
      toBlock = chunkFrom - 1;
    }
  } finally {
    provider.destroy();
  }

  return null;
}

/**
 * When this payment started waiting for USDC. The conversion timestamp is the
 * honest start; `createdAt` is the fallback for rows written before it existed.
 */
export function waitingSinceMsOf(row: {
  createdAt: Date;
  metadata: unknown;
}): number {
  const metadata = (row.metadata as Record<string, unknown>) ?? {};
  const queuedAt = metadata.fiatToUsdcConversionQueuedAt;
  if (typeof queuedAt === 'string') {
    const parsed = Date.parse(queuedAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  return row.createdAt.getTime();
}

function isMacroClickProvider(provider: string): boolean {
  return provider === 'macro_click' || provider.startsWith('macro_click');
}

async function loadExistingConversionMeta(
  resolved: NonNullable<ResolvedCheckoutReference>
): Promise<Record<string, unknown> | null> {
  if (resolved.kind === 'deposit') {
    const deposit = await prisma.platformDeposit.findUnique({
      where: { id: resolved.depositId },
      select: { metadata: true }
    });
    return (deposit?.metadata as Record<string, unknown>) ?? null;
  }
  if (resolved.kind === 'payment_intent') {
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: resolved.intentId },
      select: { metadata: true }
    });
    return (intent?.metadata as Record<string, unknown>) ?? null;
  }
  const intents = await loadCartBatchIntentsAnyStatus(resolved.userId, resolved.batchId);
  return (intents[0]?.metadata as Record<string, unknown>) ?? null;
}

function resolveMacroLocalArs(input: {
  fiatCurrency?: 'ARS' | 'USD' | null;
  localAmount?: number | null;
  prior?: Record<string, unknown> | null;
}): number | null {
  if (input.fiatCurrency === 'USD') return null;
  if (typeof input.localAmount === 'number' && Number.isFinite(input.localAmount) && input.localAmount > 0) {
    return input.localAmount;
  }
  const priorLocal = input.prior?.localAmount;
  if (typeof priorLocal === 'number' && Number.isFinite(priorLocal) && priorLocal > 0) {
    const priorCurrency =
      typeof input.prior?.currency === 'string' ? input.prior.currency.toUpperCase() : null;
    if (!priorCurrency || priorCurrency === 'ARS') return priorLocal;
  }
  return null;
}

/**
 * After Macro / MP / Pix fiat is paid: queue conversion metadata and optionally create a Ripio
 * on-ramp order so ARS can become USDC on Base treasury.
 * Settlement always waits for USDC on Base — never confirms on fiat alone.
 *
 * Macro ARS → Ripio bank_transfer (exact pesos). Macro USD cannot use Ripio AR (ARS-only).
 */
export async function enqueueFiatToUsdcConversion(input: {
  externalReference: string;
  provider: string;
  amountUsd: number;
  userId?: string | null;
  userEmail?: string | null;
  fiatCurrency?: 'ARS' | 'USD' | null;
  localAmount?: number | null;
}): Promise<{ queued: boolean; ripio?: Record<string, unknown> }> {
  const reference = input.externalReference.trim();
  if (!reference) {
    return { queued: false };
  }

  const resolved = await resolveCheckoutReferenceByPartnerOrderId(reference);
  const priorMeta = resolved ? await loadExistingConversionMeta(resolved) : null;

  if (typeof priorMeta?.ripioExternalRef === 'string' && priorMeta.ripioExternalRef.trim()) {
    return {
      queued: true,
      ripio: {
        ripioConversionQueued: true,
        ripioExternalRef: priorMeta.ripioExternalRef,
        ripioIdempotentReuse: true
      }
    };
  }

  const macro = isMacroClickProvider(input.provider);
  const fiatCurrency =
    input.fiatCurrency === 'ARS' || input.fiatCurrency === 'USD'
      ? input.fiatCurrency
      : typeof priorMeta?.currency === 'string' &&
          (priorMeta.currency.toUpperCase() === 'ARS' || priorMeta.currency.toUpperCase() === 'USD')
        ? (priorMeta.currency.toUpperCase() as 'ARS' | 'USD')
        : macro
          ? 'ARS'
          : null;

  let ripioMeta: Record<string, unknown> | undefined;
  let conversionProvider: 'ripio' | 'treasury_ops' = ripioConfigured() ? 'ripio' : 'treasury_ops';
  let conversionBlockedReason: string | null = null;

  if (macro && fiatCurrency === 'USD') {
    conversionProvider = 'treasury_ops';
    conversionBlockedReason = 'RIPIO_ONRAMP_ARS_ONLY';
  } else if (ripioConfigured() && input.userId && input.userEmail) {
    const exactArs = macro ? resolveMacroLocalArs({ fiatCurrency, localAmount: input.localAmount, prior: priorMeta }) : null;
    const paymentOptionRail =
      input.provider.includes('pix') || input.provider === 'mercado_pago'
        ? 'mercado_pago'
        : macro
          ? 'bank_transfer'
          : undefined;

    const ripio = await createRipioOnRampCheckout({
      depositId: reference,
      amountUsd: input.amountUsd,
      fiatAmountArs: exactArs,
      userId: input.userId,
      userEmail: input.userEmail,
      paymentOptionRail,
      autoSimulateSandboxDeposit: macro,
      redirectPath: `/marketplace/carrito?status=pending&ref=${encodeURIComponent(reference)}`
    });

    const ripioError = typeof ripio.metadata?.error === 'string' ? ripio.metadata.error : null;
    if (ripioError) {
      conversionProvider = 'treasury_ops';
      conversionBlockedReason = ripioError;
    }

    ripioMeta = {
      ripioConversionQueued: !ripioError,
      ripioProviderPaymentId: ripio.providerPaymentId ?? null,
      ripioExternalRef:
        typeof ripio.metadata?.ripioExternalRef === 'string' ? ripio.metadata.ripioExternalRef : null,
      ripioMetadata: ripio.metadata ?? null,
      ...(macro
        ? {
            macroRipioBridge: true,
            ripioAwaitingFiatFunding: !ripio.metadata?.sandboxDepositSimulated && !ripioError,
            macroLocalAmountArs: exactArs,
            macroFiatCurrency: fiatCurrency
          }
        : {})
    };
  } else if (!ripioConfigured()) {
    conversionProvider = 'treasury_ops';
    conversionBlockedReason = 'RIPIO_NOT_CONFIGURED';
  }

  const conversionPayload = {
    fiatToUsdcConversionQueuedAt: new Date().toISOString(),
    awaitingTreasuryUsdc: true,
    settlementPolicy: 'treasury_first',
    conversionProvider,
    ...(conversionBlockedReason ? { conversionBlockedReason } : {}),
    ...(fiatCurrency ? { currency: fiatCurrency } : {}),
    ...(typeof input.localAmount === 'number' ? { localAmount: input.localAmount } : {}),
    ...ripioMeta
  };

  if (resolved?.kind === 'deposit') {
    const deposit = await prisma.platformDeposit.findUnique({ where: { id: resolved.depositId } });
    if (deposit) {
      const prior = (deposit.metadata as Record<string, unknown>) ?? {};
      await prisma.platformDeposit.update({
        where: { id: deposit.id },
        data: {
          metadata: { ...prior, ...conversionPayload } as Prisma.InputJsonObject
        }
      });
    }
  } else if (resolved?.kind === 'cart') {
    const intents = await loadCartBatchIntentsAnyStatus(resolved.userId, resolved.batchId);
    for (const intent of intents) {
      const prior = (intent.metadata as Record<string, unknown>) ?? {};
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          metadata: { ...prior, ...conversionPayload, cartBatchId: resolved.batchId } as Prisma.InputJsonObject
        }
      });
    }
  } else if (resolved?.kind === 'payment_intent') {
    const intent = await prisma.paymentIntent.findUnique({ where: { id: resolved.intentId } });
    if (intent) {
      const prior = (intent.metadata as Record<string, unknown>) ?? {};
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          metadata: { ...prior, ...conversionPayload } as Prisma.InputJsonObject
        }
      });
    }
  }

  return { queued: true, ripio: ripioMeta };
}

async function settleIfUsdcFound(
  reference: NonNullable<ResolvedCheckoutReference>,
  provider: string,
  waitingSinceMs?: number | null
) {
  const expectedAmountUsd = await resolveExpectedAmountUsd(reference);
  const txHash = await findMatchingTreasuryUsdcTransfer(expectedAmountUsd, { waitingSinceMs });
  if (!txHash) {
    return { settled: false as const };
  }

  const partnerId =
    reference.kind === 'deposit'
      ? reference.depositId
      : reference.kind === 'cart'
        ? reference.batchId
        : reference.intentId;

  const result = await settleOnRampCheckout({
    reference,
    provider,
    providerPaymentId: partnerId,
    treasuryTxnHash: txHash,
    expectedAmountUsd,
    payload: { autoDetectedTreasuryUsdc: true, source: 'awaiting_usdc_watcher' }
  });

  return { settled: true as const, result, txHash };
}

/** Sweep MANUAL_REVIEW / awaitingTreasuryUsdc deposits and cart batches for matching USDC. */
export async function scanAwaitingTreasuryUsdcSettlements() {
  const confirmed: string[] = [];

  const deposits = await prisma.platformDeposit.findMany({
    where: { status: 'MANUAL_REVIEW' },
    take: 50,
    orderBy: { createdAt: 'desc' }
  });

  for (const deposit of deposits) {
    const metadata = (deposit.metadata as Record<string, unknown>) ?? {};
    if (metadata.awaitingTreasuryUsdc !== true) continue;
    try {
      const outcome = await settleIfUsdcFound(
        { kind: 'deposit', depositId: deposit.id },
        String(metadata.fiatRailProvider ?? deposit.provider ?? 'treasury_usdc_watch'),
        waitingSinceMsOf(deposit)
      );
      if (outcome.settled) confirmed.push(deposit.id);
    } catch (error) {
      console.error('[scanAwaitingTreasuryUsdcSettlements] deposit', deposit.id, error);
    }
  }

  const intents = await prisma.paymentIntent.findMany({
    where: { status: 'MANUAL_REVIEW' },
    take: 80,
    orderBy: { createdAt: 'desc' }
  });

  const seenBatches = new Set<string>();
  for (const intent of intents) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    if (metadata.awaitingTreasuryUsdc !== true) continue;
    const batchId = typeof metadata.cartBatchId === 'string' ? metadata.cartBatchId : null;
    if (batchId) {
      if (seenBatches.has(batchId)) continue;
      seenBatches.add(batchId);
      try {
        const outcome = await settleIfUsdcFound(
          { kind: 'cart', batchId, userId: intent.userId },
          String(metadata.fiatRailProvider ?? intent.provider ?? 'treasury_usdc_watch'),
          waitingSinceMsOf(intent)
        );
        if (outcome.settled) confirmed.push(batchId);
      } catch (error) {
        console.error('[scanAwaitingTreasuryUsdcSettlements] cart', batchId, error);
      }
    } else {
      try {
        const outcome = await settleIfUsdcFound(
          { kind: 'payment_intent', intentId: intent.id, userId: intent.userId },
          String(metadata.fiatRailProvider ?? intent.provider ?? 'treasury_usdc_watch'),
          waitingSinceMsOf(intent)
        );
        if (outcome.settled) confirmed.push(intent.id);
      } catch (error) {
        console.error('[scanAwaitingTreasuryUsdcSettlements] intent', intent.id, error);
      }
    }
  }

  return { scannedDeposits: deposits.length, scannedIntents: intents.length, confirmed };
}

/**
 * Scan treasury USDC logs for a cart batch total (crypto purchase auto-detect).
 */
export async function scanTreasuryForPendingCartUsdcBatch(userId: string, batchId: string) {
  const intents = await loadCartBatchIntentsAnyStatus(userId, batchId);
  if (!intents.length) {
    return { found: false, allConfirmed: false, paymentIntents: [] as unknown[] };
  }

  if (intents.every((row) => row.status === 'CONFIRMED')) {
    return {
      found: true,
      allConfirmed: true,
      paymentIntents: intents
    };
  }

  const payable = intents.filter((row) =>
    ['PENDING', 'REQUIRES_PAYMENT', 'MANUAL_REVIEW'].includes(row.status)
  );
  if (!payable.length) {
    return { found: true, allConfirmed: false, paymentIntents: intents };
  }

  const first = payable[0];
  const metadata = (first.metadata as Record<string, unknown>) ?? {};
  const watchAmountUsd =
    typeof metadata.qrWatchAmountUsd === 'number'
      ? metadata.qrWatchAmountUsd
      : payable.reduce((sum, row) => sum + row.amountUsd.toNumber(), 0);

  // A QR the investor left open for hours must still be findable; the window
  // follows the intent's own age instead of a fixed hundred minutes.
  const txHash = await findMatchingTreasuryUsdcTransfer(watchAmountUsd, {
    waitingSinceMs: waitingSinceMsOf(first)
  });
  if (!txHash) {
    return { found: true, allConfirmed: false, paymentIntents: intents };
  }

  for (const intent of payable) {
    if (intent.status === 'MANUAL_REVIEW') {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'REQUIRES_PAYMENT' }
      });
    }
  }

  const paymentIntents = await confirmCartPurchaseBatch({
    userId,
    batchId,
    provider: 'usdc_onchain_qr_watch',
    providerPaymentId: txHash,
    txHash,
    payload: { autoDetected: true, watchAmountUsd }
  });

  return { found: true, allConfirmed: true, paymentIntents };
}

/** Re-export for deposit auto-confirm used by crypto path */
export { confirmPlatformDeposit };
