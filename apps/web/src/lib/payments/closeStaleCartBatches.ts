import { prisma, type Prisma } from '@sanova/database';

export type CloseStaleCartBatchesResult = {
  userId: string;
  keptBatchId: string | null;
  closedBatchIds: string[];
  closedIntentIds: string[];
};

/**
 * Expire every open USDC cart batch for an investor except `keepBatchId`.
 *
 * Each failed “Pagar” attempt used to leave its batch in REQUIRES_PAYMENT, so a
 * single purchase accumulated several open 20 USDC carts that all looked payable.
 */
export async function closeStaleOpenCartBatches(input: {
  userId: string;
  keepBatchId?: string | null;
  reason?: string;
}): Promise<CloseStaleCartBatchesResult> {
  const intents = await prisma.paymentIntent.findMany({
    where: {
      userId: input.userId,
      method: 'USDC_ONCHAIN',
      status: { in: ['REQUIRES_PAYMENT', 'PENDING'] }
    },
    select: { id: true, metadata: true }
  });

  const keep = input.keepBatchId?.trim() || null;
  const closedBatchIds = new Set<string>();
  const closedIntentIds: string[] = [];

  for (const intent of intents) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    const batchId =
      typeof metadata.cartBatchId === 'string' && metadata.cartBatchId.trim()
        ? metadata.cartBatchId.trim()
        : null;

    if (keep && batchId === keep) continue;

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: 'EXPIRED',
        metadata: {
          ...metadata,
          closedAsStaleAt: new Date().toISOString(),
          closedAsStaleReason: input.reason ?? 'SUPERSEDED_CART_BATCH'
        } as Prisma.InputJsonObject
      }
    });

    closedIntentIds.push(intent.id);
    if (batchId) closedBatchIds.add(batchId);
  }

  return {
    userId: input.userId,
    keptBatchId: keep,
    closedBatchIds: [...closedBatchIds],
    closedIntentIds
  };
}
