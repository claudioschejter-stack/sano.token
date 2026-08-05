import { prisma, type Prisma } from '@sanova/database';
import { releaseSupplyForIntent } from './paymentSupplyReservation';
import { recordTokenMovement } from '../reconciliation/tokenMovementLedger';
import { getStablecoinNetwork } from './stablecoinNetworks';

export type RefundCryptoPurchaseResult = {
  batchId: string;
  refundedIntentIds: string[];
  releasedTokens: number;
  refundUsd: number;
  /** Set when ops already sent USDC back on-chain. */
  refundTxHash: string | null;
};

/**
 * Refund a confirmed crypto purchase whose RWA delivery cannot be completed.
 *
 * Marks the batch REFUNDED, returns the tokens to project supply and records the
 * refund in the movement ledger. The USDC transfer itself is executed by ops from
 * treasury; pass `refundTxHash` so the bitácora links both sides.
 */
export async function refundCryptoPurchase(input: {
  userId: string;
  batchId: string;
  reason: string;
  refundTxHash?: string | null;
  refundLogIndex?: number | null;
  refundBlockNumber?: number | null;
  actor?: string | null;
}): Promise<RefundCryptoPurchaseResult> {
  const intents = await prisma.paymentIntent.findMany({
    where: { userId: input.userId },
    select: {
      id: true,
      status: true,
      projectId: true,
      tokenCount: true,
      amountUsd: true,
      payerWalletAddress: true,
      metadata: true
    }
  });

  const batchIntents = intents.filter((intent) => {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    return metadata.cartBatchId === input.batchId;
  });

  if (!batchIntents.length) {
    throw new Error('CART_BATCH_NOT_FOUND');
  }

  const refundedIntentIds: string[] = [];
  let releasedTokens = 0;
  let refundUsd = 0;
  let payerAddress: string | null = null;

  for (const intent of batchIntents) {
    if (intent.status === 'REFUNDED') continue;
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    payerAddress = payerAddress ?? intent.payerWalletAddress ?? null;

    await prisma.$transaction(async (tx) => {
      // Confirmed purchases consumed the reservation; expired ones may still hold it.
      await releaseSupplyForIntent(tx, intent);
      if (intent.status === 'CONFIRMED') {
        await tx.project.update({
          where: { id: intent.projectId },
          data: { availableTokens: { increment: intent.tokenCount } }
        });
      }
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'REFUNDED',
          metadata: {
            ...metadata,
            supplyReserved: false,
            refundedAt: new Date().toISOString(),
            refundReason: input.reason,
            refundTxHash: input.refundTxHash ?? null,
            refundedBy: input.actor ?? null
          } as Prisma.InputJsonObject
        }
      });
    });

    refundedIntentIds.push(intent.id);
    releasedTokens += intent.tokenCount;
    refundUsd += Number(intent.amountUsd);
  }

  const network = getStablecoinNetwork('BASE');
  if (
    input.refundTxHash?.trim() &&
    network.tokenAddress &&
    network.treasuryAddress &&
    payerAddress
  ) {
    await recordTokenMovement({
      kind: 'USDC_REFUND',
      // A refund and a rent payout look identical on-chain; this one knows.
      authoritative: true,
      asset: 'USDC',
      contractAddress: network.tokenAddress,
      fromAddress: network.treasuryAddress,
      toAddress: payerAddress,
      amountRaw: BigInt(Math.round(refundUsd * 10 ** (network.decimals ?? 6))).toString(),
      decimals: network.decimals ?? 6,
      txHash: input.refundTxHash.trim(),
      logIndex: input.refundLogIndex ?? 0,
      blockNumber: input.refundBlockNumber ?? 0,
      userId: input.userId,
      projectId: batchIntents[0]?.projectId ?? null,
      metadata: { source: 'refund', batchId: input.batchId, reason: input.reason }
    }).catch((error) => {
      console.error('[refundCryptoPurchase] movement ledger write failed', error);
    });
  }

  return {
    batchId: input.batchId,
    refundedIntentIds,
    releasedTokens,
    refundUsd: Number(refundUsd.toFixed(6)),
    refundTxHash: input.refundTxHash?.trim() || null
  };
}
