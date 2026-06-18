import { prisma, Prisma } from '@sanova/database';
import { confirmCartBatchByProvider, markCartBatchPaymentFailed } from './cartCheckoutService';
import { confirmPaymentIntent, markPaymentIntentFailed } from './paymentService';
import { confirmPlatformDeposit } from './platformWalletService';
import {
  dispatchFiatRailTreasuryWebhook,
  FIAT_RAIL_TREASURY_PROVIDERS
} from './fiatRailTreasurySettlement';

type PaymentWebhookDispatchInput = {
  externalReference: string;
  provider: string;
  providerPaymentId?: string | null;
  paid: boolean;
  failed: boolean;
  payload: Record<string, unknown>;
};

export async function dispatchPaymentWebhook(input: PaymentWebhookDispatchInput) {
  const reference = input.externalReference.trim();
  if (!reference) {
    return { ok: true, ignored: 'missing_reference' };
  }

  if (FIAT_RAIL_TREASURY_PROVIDERS.has(input.provider)) {
    return dispatchFiatRailTreasuryWebhook({
      externalReference: reference,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      paid: input.paid,
      failed: input.failed,
      payload: input.payload,
      treasuryTxnHash:
        typeof input.payload.treasuryTxnHash === 'string' ? input.payload.treasuryTxnHash : null
    });
  }

  const cartBatchId =
    typeof input.payload.cartBatchId === 'string'
      ? input.payload.cartBatchId
      : reference.startsWith('cart-')
        ? reference
        : null;

  if (input.paid && cartBatchId) {
    const paymentIntents = await confirmCartBatchByProvider({
      batchId: cartBatchId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      payload: input.payload as Prisma.InputJsonValue
    });
    return { ok: true, paymentIntents };
  }

  if (input.failed && cartBatchId) {
    const paymentIntents = await markCartBatchPaymentFailed({
      batchId: cartBatchId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      payload: input.payload as Prisma.InputJsonValue
    });
    return { ok: true, paymentIntents };
  }

  const deposit = await prisma.platformDeposit.findUnique({ where: { id: reference } });
  if (deposit) {
    if (input.paid) {
      const confirmed = await confirmPlatformDeposit({
        depositId: reference,
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        metadata: input.payload as Prisma.InputJsonValue
      });
      return { ok: true, deposit: confirmed };
    }
    return { ok: true, ignored: 'deposit_not_paid' };
  }

  const paymentIntent = await prisma.paymentIntent.findUnique({ where: { id: reference } });
  if (paymentIntent) {
    if (input.paid) {
      const confirmed = await confirmPaymentIntent({
        paymentIntentId: reference,
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        payload: input.payload as Prisma.InputJsonValue
      });
      return { ok: true, paymentIntent: confirmed };
    }

    if (input.failed) {
      const failed = await markPaymentIntentFailed({
        paymentIntentId: reference,
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        payload: input.payload as Prisma.InputJsonValue
      });
      return { ok: true, paymentIntent: failed };
    }
  }

  if (input.paid) {
    const paymentIntent = await confirmPaymentIntent({
      paymentIntentId: reference,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      payload: input.payload as Prisma.InputJsonValue
    });
    return { ok: true, paymentIntent };
  }

  return { ok: true, ignored: 'unmatched_reference' };
}
