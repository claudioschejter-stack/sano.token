import { prisma, type Prisma } from '@sanova/database';
import { confirmCartPurchaseBatch, loadCartBatchIntentsAnyStatus } from './cartCheckoutService';
import { confirmPlatformDeposit } from './platformWalletService';
import type { ResolvedCheckoutReference } from './checkoutReferenceResolver';

export type OnRampSettlementInput = {
  reference: ResolvedCheckoutReference;
  provider: string;
  providerPaymentId: string;
  payload: Record<string, unknown>;
  treasuryTxnHash?: string | null;
};

/** Fiat/crypto on-ramps settle to Base USDC treasury first; tokens RWA se entregan después. */
export async function settleOnRampCheckout(input: OnRampSettlementInput) {
  const enrichedPayload = {
    ...input.payload,
    settlement: 'treasury_first',
    treasuryTxnHash: input.treasuryTxnHash ?? null,
    provider: input.provider
  } as Prisma.InputJsonValue;

  if (input.reference.kind === 'deposit') {
    const deposit = await confirmPlatformDeposit({
      depositId: input.reference.depositId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      metadata: enrichedPayload as Record<string, unknown>
    });
    return { kind: 'deposit' as const, deposit };
  }

  const intents = await loadCartBatchIntentsAnyStatus(input.reference.userId, input.reference.batchId);
  if (!intents.length) throw new Error('CART_BATCH_NOT_FOUND');

  for (const intent of intents) {
    if (intent.status === 'MANUAL_REVIEW') {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'REQUIRES_PAYMENT' }
      });
    }
  }

  const paymentIntents = await confirmCartPurchaseBatch({
    userId: input.reference.userId,
    batchId: input.reference.batchId,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    txHash: input.treasuryTxnHash ?? undefined,
    payload: enrichedPayload
  });

  return { kind: 'cart' as const, paymentIntents };
}
