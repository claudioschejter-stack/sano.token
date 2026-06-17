import { prisma } from '@sanova/database';

export type ResolvedCheckoutReference =
  | { kind: 'deposit'; depositId: string }
  | { kind: 'cart'; batchId: string; userId: string }
  | null;

export async function resolveCheckoutReferenceByRipioExternalRef(
  externalRef: string
): Promise<ResolvedCheckoutReference> {
  const ref = externalRef.trim();
  if (!ref) return null;

  const deposit = await prisma.platformDeposit.findFirst({
    where: { metadata: { path: ['ripioExternalRef'], equals: ref } },
    select: { id: true }
  });
  if (deposit) return { kind: 'deposit', depositId: deposit.id };

  const intents = await prisma.paymentIntent.findMany({
    where: {
      OR: [
        { metadata: { path: ['gateway', 'ripioExternalRef'], equals: ref } },
        { metadata: { path: ['ripioExternalRef'], equals: ref } }
      ]
    },
    select: { userId: true, metadata: true },
    take: 5
  });

  for (const intent of intents) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    const batchId = typeof metadata.cartBatchId === 'string' ? metadata.cartBatchId : null;
    if (batchId) return { kind: 'cart', batchId, userId: intent.userId };
  }

  return null;
}

export async function resolveCheckoutReferenceByPartnerOrderId(
  partnerOrderId: string
): Promise<ResolvedCheckoutReference> {
  const ref = partnerOrderId.trim();
  if (!ref) return null;

  const deposit = await prisma.platformDeposit.findUnique({
    where: { id: ref },
    select: { id: true }
  });
  if (deposit) return { kind: 'deposit', depositId: deposit.id };

  const intent = await prisma.paymentIntent.findFirst({
    where: { metadata: { path: ['cartBatchId'], equals: ref } },
    select: { userId: true }
  });
  if (intent) return { kind: 'cart', batchId: ref, userId: intent.userId };

  return null;
}
