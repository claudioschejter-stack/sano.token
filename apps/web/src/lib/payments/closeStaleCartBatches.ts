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

/** How long a payment under review may hold its tokens out of stock. */
function manualReviewHoldMinutes(): number {
  const raw = Number(process.env.MANUAL_REVIEW_HOLD_MINUTES ?? 720);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 7 * 24 * 60) : 720;
}

/**
 * Return supply for any expired reservation, regardless of owner.
 * `PAYMENT_ORDER_TTL_MINUTES` only sets `expiresAt`; without this sweep the
 * tokens stayed out of stock until the next daily maintenance cron.
 */
export async function expireStaleCartReservations(
  limit = 200
): Promise<ExpireStaleReservationsResult> {
  const now = new Date();

  /**
   * `MANUAL_REVIEW` held its reservation forever: it is not past `expiresAt`
   * from the sweep's point of view and nothing else releases it, so a purchase
   * flagged for review — or a fiat rail waiting on treasury USDC that never
   * arrived — kept its tokens out of stock indefinitely.
   *
   * Reviews get a longer window than a checkout because someone has to look at
   * them, but not an unlimited one: after it, the tokens go back on sale and
   * the payment can be re-taken.
   */
  const reviewCutoff = new Date(now.getTime() - manualReviewHoldMinutes() * 60_000);

  const stale = await prisma.paymentIntent.findMany({
    where: {
      OR: [
        {
          status: { in: ['REQUIRES_PAYMENT', 'PENDING'] },
          expiresAt: { lte: now }
        },
        {
          status: 'MANUAL_REVIEW',
          updatedAt: { lte: reviewCutoff }
        }
      ]
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
    select: { id: true, projectId: true, tokenCount: true, metadata: true, status: true }
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
            expiredReason:
              intent.status === 'MANUAL_REVIEW'
                ? 'MANUAL_REVIEW_HOLD_ELAPSED'
                : 'RESERVATION_TTL_ELAPSED'
          } as Prisma.InputJsonObject
        }
      });
    });

    if (reserved) releasedTokens += intent.tokenCount;
    expiredIntentIds.push(intent.id);
  }

  return { expiredIntentIds, releasedTokens };
}
