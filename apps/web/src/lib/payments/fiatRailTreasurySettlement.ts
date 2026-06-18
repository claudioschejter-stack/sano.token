import { prisma, type Prisma } from '@sanova/database';
import { settleOnRampCheckout } from './checkoutTreasurySettlement';
import {
  resolveCheckoutReferenceByPartnerOrderId,
  resolveExpectedAmountUsd
} from './checkoutReferenceResolver';
import { confirmCartBatchByProvider } from './cartCheckoutService';
import { confirmPlatformDeposit } from './platformWalletService';

export const FIAT_RAIL_TREASURY_PROVIDERS = new Set(['dlocal', 'ebanx']);

export type FiatRailWebhookInput = {
  externalReference: string;
  provider: string;
  providerPaymentId?: string | null;
  paid: boolean;
  failed: boolean;
  payload: Record<string, unknown>;
  treasuryTxnHash?: string | null;
};

function treasurySettlementPayload(input: FiatRailWebhookInput): Prisma.InputJsonValue {
  return {
    ...input.payload,
    settlementPolicy: 'treasury_first',
    awaitingTreasuryUsdc: true,
    fiatRailProvider: input.provider,
    provider: input.provider
  } as Prisma.InputJsonValue;
}

/** Fiat local rails (SPEI/UPI/Pix): confirm only after USDC lands in Base treasury. */
export async function dispatchFiatRailTreasuryWebhook(input: FiatRailWebhookInput) {
  const reference = input.externalReference.trim();
  if (!reference) {
    return { ok: true, ignored: 'missing_reference' };
  }

  if (input.failed) {
    return { ok: true, ignored: 'fiat_rail_not_paid' };
  }

  if (!input.paid) {
    return { ok: true, ignored: 'fiat_rail_pending' };
  }

  const treasuryTxnHash = input.treasuryTxnHash?.trim() ?? null;
  if (treasuryTxnHash) {
    const resolved = await resolveCheckoutReferenceByPartnerOrderId(reference);
    if (resolved) {
      const expectedAmountUsd = await resolveExpectedAmountUsd(resolved);
      const result = await settleOnRampCheckout({
        reference: resolved,
        provider: input.provider,
        providerPaymentId: input.providerPaymentId ?? reference,
        treasuryTxnHash,
        expectedAmountUsd,
        payload: input.payload
      });
      return { ok: true, settled: true, result };
    }
  }

  const cartBatchId =
    typeof input.payload.cartBatchId === 'string'
      ? input.payload.cartBatchId
      : reference.startsWith('cart-')
        ? reference
        : null;

  if (cartBatchId) {
    const intents = await prisma.paymentIntent.findMany({
      where: { metadata: { path: ['cartBatchId'], equals: cartBatchId } }
    });

    for (const intent of intents) {
      const prior = (intent.metadata as Record<string, unknown>) ?? {};
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'MANUAL_REVIEW',
          provider: input.provider,
          providerPaymentId: input.providerPaymentId ?? reference,
          metadata: {
            ...prior,
            ...treasurySettlementPayload(input),
            cartBatchId
          } as Prisma.InputJsonObject
        }
      });
    }

    return { ok: true, awaitingTreasuryUsdc: true, batchId: cartBatchId };
  }

  const deposit = await prisma.platformDeposit.findUnique({ where: { id: reference } });
  if (deposit) {
    const prior = (deposit.metadata as Record<string, unknown>) ?? {};
    const updated = await prisma.platformDeposit.update({
      where: { id: reference },
      data: {
        status: 'MANUAL_REVIEW',
        provider: input.provider,
        providerPaymentId: input.providerPaymentId ?? reference,
        metadata: {
          ...prior,
          ...treasurySettlementPayload(input)
        } as Prisma.InputJsonObject
      }
    });
    return { ok: true, awaitingTreasuryUsdc: true, deposit: updated.id };
  }

  if (input.paid) {
    try {
      const paymentIntents = await confirmCartBatchByProvider({
        batchId: reference,
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        payload: treasurySettlementPayload(input)
      });
      if (paymentIntents.length > 0) {
        return { ok: true, paymentIntents };
      }
    } catch {
      /* fall through */
    }

    try {
      const confirmed = await confirmPlatformDeposit({
        depositId: reference,
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        metadata: treasurySettlementPayload(input)
      });
      return { ok: true, deposit: confirmed };
    } catch {
      return { ok: true, ignored: 'unmatched_fiat_rail_reference' };
    }
  }

  return { ok: true, ignored: 'unmatched_fiat_rail_reference' };
}
