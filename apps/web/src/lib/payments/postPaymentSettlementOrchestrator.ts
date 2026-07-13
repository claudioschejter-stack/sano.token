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
const WATCH_LOOKBACK_BLOCKS = 3000;

function amountToleranceMatch(actual: bigint, expected: bigint): boolean {
  if (actual === expected) return true;
  // Allow ±1 cent of USDC (6 decimals) for FX rounding
  const tol = 10_000n;
  const diff = actual > expected ? actual - expected : expected - actual;
  return diff <= tol;
}

async function findMatchingTreasuryUsdcTransfer(expectedAmountUsd: number): Promise<string | null> {
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
    const fromBlock = Math.max(0, latestBlock - WATCH_LOOKBACK_BLOCKS);

    const logs = await provider.getLogs({
      address: network.tokenAddress,
      topics: [USDC_TRANSFER_TOPIC, null, ethers.zeroPadValue(expectedTo, 32)],
      fromBlock,
      toBlock: latestBlock
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
  } finally {
    provider.destroy();
  }

  return null;
}

/**
 * After MP/Pix fiat is paid: queue conversion metadata and optionally create a Ripio
 * conversion order keyed to the same partner reference (ops/webhook completes USDC).
 * Settlement always waits for USDC on Base treasury — never confirms on fiat alone.
 */
export async function enqueueFiatToUsdcConversion(input: {
  externalReference: string;
  provider: string;
  amountUsd: number;
  userId?: string | null;
  userEmail?: string | null;
}): Promise<{ queued: boolean; ripio?: Record<string, unknown> }> {
  const reference = input.externalReference.trim();
  if (!reference) {
    return { queued: false };
  }

  const resolved = await resolveCheckoutReferenceByPartnerOrderId(reference);
  let ripioMeta: Record<string, unknown> | undefined;

  if (ripioConfigured() && input.userId && input.userEmail) {
    const ripio = await createRipioOnRampCheckout({
      depositId: reference,
      amountUsd: input.amountUsd,
      userId: input.userId,
      userEmail: input.userEmail,
      paymentOptionRail:
        input.provider.includes('pix') || input.provider === 'mercado_pago' ? 'mercado_pago' : undefined,
      redirectPath: `/marketplace/carrito?status=pending&ref=${encodeURIComponent(reference)}`
    });
    ripioMeta = {
      ripioConversionQueued: true,
      ripioProviderPaymentId: ripio.providerPaymentId ?? null,
      ripioExternalRef:
        typeof ripio.metadata?.ripioExternalRef === 'string' ? ripio.metadata.ripioExternalRef : null,
      ripioMetadata: ripio.metadata ?? null
    };
  }

  const conversionPayload = {
    fiatToUsdcConversionQueuedAt: new Date().toISOString(),
    awaitingTreasuryUsdc: true,
    settlementPolicy: 'treasury_first',
    conversionProvider: ripioConfigured() ? 'ripio' : 'treasury_ops',
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

async function settleIfUsdcFound(reference: NonNullable<ResolvedCheckoutReference>, provider: string) {
  const expectedAmountUsd = await resolveExpectedAmountUsd(reference);
  const txHash = await findMatchingTreasuryUsdcTransfer(expectedAmountUsd);
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
        String(metadata.fiatRailProvider ?? deposit.provider ?? 'treasury_usdc_watch')
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
          String(metadata.fiatRailProvider ?? intent.provider ?? 'treasury_usdc_watch')
        );
        if (outcome.settled) confirmed.push(batchId);
      } catch (error) {
        console.error('[scanAwaitingTreasuryUsdcSettlements] cart', batchId, error);
      }
    } else {
      try {
        const outcome = await settleIfUsdcFound(
          { kind: 'payment_intent', intentId: intent.id, userId: intent.userId },
          String(metadata.fiatRailProvider ?? intent.provider ?? 'treasury_usdc_watch')
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

  const txHash = await findMatchingTreasuryUsdcTransfer(watchAmountUsd);
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
