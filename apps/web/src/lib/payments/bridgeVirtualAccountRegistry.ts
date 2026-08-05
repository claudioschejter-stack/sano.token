import { prisma } from '@sanova/database';

/**
 * Who owns each Bridge virtual account.
 *
 * Bridge issues one account per customer, which means an incoming wire is
 * identified by *which account received it* — not by a reference the sender has
 * to type correctly into their bank's memo field. That is a far stronger signal,
 * and it was being thrown away: nothing recorded the mapping, so a deposit
 * arriving without a usable reference could not be attributed to anyone.
 */

export async function rememberVirtualAccount(input: {
  virtualAccountId: string;
  bridgeCustomerId: string;
  userId: string;
  currency: string;
}): Promise<void> {
  const virtualAccountId = input.virtualAccountId?.trim();
  if (!virtualAccountId || !input.userId?.trim()) {
    return;
  }

  await prisma.bridgeVirtualAccount
    .upsert({
      where: { virtualAccountId },
      create: {
        virtualAccountId,
        bridgeCustomerId: input.bridgeCustomerId.trim(),
        userId: input.userId.trim(),
        currency: input.currency.trim().toLowerCase()
      },
      update: {
        bridgeCustomerId: input.bridgeCustomerId.trim(),
        userId: input.userId.trim(),
        currency: input.currency.trim().toLowerCase()
      }
    })
    .catch((error) => {
      // Never fail issuing an account over bookkeeping.
      console.error('[rememberVirtualAccount] failed', error);
      return null;
    });
}

/** The investor a deposit belongs to, by the account or customer that received it. */
export async function resolveVirtualAccountOwner(input: {
  virtualAccountId?: string | null;
  bridgeCustomerId?: string | null;
}): Promise<{ userId: string; virtualAccountId: string } | null> {
  const virtualAccountId = input.virtualAccountId?.trim();
  if (virtualAccountId) {
    const byAccount = await prisma.bridgeVirtualAccount
      .findUnique({ where: { virtualAccountId } })
      .catch(() => null);
    if (byAccount) {
      return { userId: byAccount.userId, virtualAccountId: byAccount.virtualAccountId };
    }
  }

  const bridgeCustomerId = input.bridgeCustomerId?.trim();
  if (bridgeCustomerId) {
    const byCustomer = await prisma.bridgeVirtualAccount
      .findFirst({ where: { bridgeCustomerId }, orderBy: { createdAt: 'desc' } })
      .catch(() => null);
    if (byCustomer) {
      return { userId: byCustomer.userId, virtualAccountId: byCustomer.virtualAccountId };
    }
  }

  return null;
}

/**
 * The open order a wire from this investor most likely pays.
 *
 * Returns null when there is more than one candidate: guessing between two open
 * orders would credit the wrong one, and the unmatched inbox exists so a person
 * can decide instead.
 */
export async function resolveOpenBatchForUser(userId: string): Promise<string | null> {
  const intents = await prisma.paymentIntent
    .findMany({
      where: { userId, status: { in: ['REQUIRES_PAYMENT', 'PENDING', 'MANUAL_REVIEW'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, metadata: true },
      take: 20
    })
    .catch(() => []);

  const batchIds = new Set<string>();
  for (const intent of intents) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    const batchId =
      typeof metadata.cartBatchId === 'string' && metadata.cartBatchId.trim()
        ? metadata.cartBatchId.trim()
        : intent.id;
    batchIds.add(batchId);
  }

  return batchIds.size === 1 ? [...batchIds][0] : null;
}
