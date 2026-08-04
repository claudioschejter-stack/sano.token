import { prisma, type Prisma } from '@sanova/database';
import { releaseSupplyForIntent } from './paymentSupplyReservation';

export type CloseStaleCartBatchesResult = {
  userId: string;
  keptBatchId: string | null;
  closedBatchIds: string[];
  closedIntentIds: string[];
  /** Tokens returned to `Project.availableTokens`. */
  releasedTokens: number;
};

/**
 * Expire every open USDC cart batch for an investor except `keepBatchId`, and
 * return their reserved tokens to the project supply.
 *
 * Each failed “Pagar” attempt used to leave its batch in REQUIRES_PAYMENT, so a
 * single purchase accumulated several open carts holding supply hostage.
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
    select: { id: true, projectId: true, tokenCount: true, metadata: true }
  });

  const keep = input.keepBatchId?.trim() || null;
  const closedBatchIds = new Set<string>();
  const closedIntentIds: string[] = [];
  let releasedTokens = 0;

  for (const intent of intents) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    const batchId =
      typeof metadata.cartBatchId === 'string' && metadata.cartBatchId.trim()
        ? metadata.cartBatchId.trim()
        : null;

    if (keep && batchId === keep) continue;

    const reserved = metadata.supplyReserved === true;

    await prisma.$transaction(async (tx) => {
      // Release first: expiring without this leaked supply out of the marketplace.
      await releaseSupplyForIntent(tx, intent);
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'EXPIRED',
          metadata: {
            ...metadata,
            supplyReserved: false,
            closedAsStaleAt: new Date().toISOString(),
            closedAsStaleReason: input.reason ?? 'SUPERSEDED_CART_BATCH'
          } as Prisma.InputJsonObject
        }
      });
    });

    if (reserved) releasedTokens += intent.tokenCount;
    closedIntentIds.push(intent.id);
    if (batchId) closedBatchIds.add(batchId);
  }

  return {
    userId: input.userId,
    keptBatchId: keep,
    closedBatchIds: [...closedBatchIds],
    closedIntentIds,
    releasedTokens
  };
}

export type ExpireStaleReservationsResult = {
  expiredIntentIds: string[];
  releasedTokens: number;
};

/**
 * Return supply for any expired reservation, regardless of owner.
 * `PAYMENT_ORDER_TTL_MINUTES` only sets `expiresAt`; without this sweep the
 * tokens stayed out of stock until the next daily maintenance cron.
 */
export async function expireStaleCartReservations(
  limit = 200
): Promise<ExpireStaleReservationsResult> {
  const stale = await prisma.paymentIntent.findMany({
    where: {
      status: { in: ['REQUIRES_PAYMENT', 'PENDING'] },
      expiresAt: { lte: new Date() }
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
    select: { id: true, projectId: true, tokenCount: true, metadata: true }
  });

  const expiredIntentIds: string[] = [];
  let releasedTokens = 0;

  for (const intent of stale) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    const reserved = metadata.supplyReserved === true;

    await prisma.$transaction(async (tx) => {
      await releaseSupplyForIntent(tx, intent);
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'EXPIRED',
          metadata: {
            ...metadata,
            supplyReserved: false,
            expiredAt: new Date().toISOString(),
            expiredReason: 'RESERVATION_TTL_ELAPSED'
          } as Prisma.InputJsonObject
        }
      });
    });

    if (reserved) releasedTokens += intent.tokenCount;
    expiredIntentIds.push(intent.id);
  }

  return { expiredIntentIds, releasedTokens };
}
