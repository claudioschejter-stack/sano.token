import { prisma } from '@sanova/database';
import type { CartLineInput } from './cartCheckoutService';
import { normalizeCartLineItems } from './normalizeCartLineItems';
import {
  isPrivyServerAutoSettleConfigured,
  paySanovaCartForUser,
  type PaySanovaCartResult
} from './paySanovaCartService';

export type PrivyAutoSettleResult = PaySanovaCartResult;

export type AutoSettlePrivyCartOptions = {
  /** Browser-observed USDC balance — used only when server RPC read fails. */
  clientBalanceUsdc?: number | null;
  /** When provided, creates the pending cart if none exists (checkout UI path). */
  items?: CartLineInput[];
  userEmail?: string | null;
};

export { isPrivyServerAutoSettleConfigured };

/**
 * Fully server-side settle for a pending USDC cart.
 * Pass `items` from the checkout UI so a missing pending batch can be created.
 */
export async function autoSettlePrivyCartForUser(
  userId: string,
  options: AutoSettlePrivyCartOptions = {}
): Promise<PrivyAutoSettleResult> {
  return paySanovaCartForUser({
    userId,
    userEmail: options.userEmail,
    items: normalizeCartLineItems(options.items),
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
