import { prisma, type Prisma } from '@sanova/database';
import { confirmCartPurchaseBatch, loadCartBatchIntentsAnyStatus } from './cartCheckoutService';
import { confirmPlatformDeposit } from './platformWalletService';
import type { ResolvedCheckoutReference } from './checkoutReferenceResolver';
import { verifyTreasuryUsdcReceipt } from './treasuryUsdcVerification';

export type OnRampSettlementInput = {
  reference: ResolvedCheckoutReference;
  provider: string;
  providerPaymentId: string;
  payload: Record<string, unknown>;
  treasuryTxnHash?: string | null;
  expectedAmountUsd: number;
};

/** Fiat/crypto on-ramps: verificar USDC en treasury Base antes de confirmar. */
export async function settleOnRampCheckout(input: OnRampSettlementInput) {
  const txHash = input.treasuryTxnHash?.trim();
  if (!txHash) {
    throw new Error('TREASURY_TX_REQUIRED');
  }

  const verification = await verifyTreasuryUsdcReceipt({
    txHash,
    expectedAmountUsd: input.expectedAmountUsd
  });

  if (!verification.ok) {
    throw new Error(verification.error);
  }

  const enrichedPayload = {
    ...input.payload,
    settlement: 'treasury_first',
    treasuryTxnHash: txHash,
    treasuryAmountBaseUnits: verification.amountBaseUnits,
    provider: input.provider,
    morphoTreasury: true
  } as Prisma.InputJsonValue;

  if (input.reference.kind === 'deposit') {
    const deposit = await confirmPlatformDeposit({
      depositId: input.reference.depositId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      txHash,
      metadata: enrichedPayload
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
    txHash,
    payload: enrichedPayload
  });

  return { kind: 'cart' as const, paymentIntents };
}
