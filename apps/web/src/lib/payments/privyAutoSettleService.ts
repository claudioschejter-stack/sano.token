import { prisma } from '@sanova/database';
import {
  isPrivyServerAutoSettleConfigured,
  paySanovaCartForUser,
  type PaySanovaCartResult
} from './paySanovaCartService';

export type PrivyAutoSettleResult = PaySanovaCartResult;

export type AutoSettlePrivyCartOptions = {
  /** Browser-observed USDC balance — used only when server RPC read fails. */
  clientBalanceUsdc?: number | null;
};

export { isPrivyServerAutoSettleConfigured };

/**
 * Fully server-side settle for an existing pending USDC cart.
 * Prefer `paySanovaCartForUser` from the checkout UI (creates the cart if needed).
 */
export async function autoSettlePrivyCartForUser(
  userId: string,
  options: AutoSettlePrivyCartOptions = {}
): Promise<PrivyAutoSettleResult> {
  return paySanovaCartForUser({
    userId,
    items: [],
    clientBalanceUsdc: options.clientBalanceUsdc
  });
}

/** Cron helper: settle every user with a ready Privy inbound cart. */
export async function autoSettleAllReadyPrivyCarts() {
  if (!isPrivyServerAutoSettleConfigured()) {
    return { attempted: 0, settled: 0, failed: 0, skipped: true as const };
  }

  const openIntents = await prisma.paymentIntent.findMany({
    where: {
      status: { in: ['REQUIRES_PAYMENT', 'PENDING'] },
      method: 'USDC_ONCHAIN',
      expiresAt: { gt: new Date() }
    },
    select: { userId: true },
    distinct: ['userId'],
    take: 50
  });

  let settled = 0;
  let failed = 0;

  for (const row of openIntents) {
    try {
      const result = await autoSettlePrivyCartForUser(row.userId);
      if (result.ok && result.status === 'settled') {
        settled += 1;
      } else if (result.ok === false) {
        failed += 1;
        console.error('[autoSettleAllReadyPrivyCarts]', row.userId, result.error);
      }
    } catch (error) {
      failed += 1;
      console.error('[autoSettleAllReadyPrivyCarts]', row.userId, error);
    }
  }

  return { attempted: openIntents.length, settled, failed, skipped: false as const };
}
