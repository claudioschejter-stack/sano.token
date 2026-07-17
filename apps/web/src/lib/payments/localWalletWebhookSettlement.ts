import { prisma } from '@sanova/database';
import { dispatchFiatRailTreasuryWebhook } from './fiatRailTreasurySettlement';
import { enqueueFiatToUsdcConversion } from './postPaymentSettlementOrchestrator';
import { linkFiatIdentity } from '../investor/linkedFiatIdentityService';

export type LocalWalletSettlementInput = {
  externalReference?: string | null;
  provider: 'mercado_pago' | 'modo' | string;
  providerPaymentId?: string | null;
  amountUsd?: number | null;
  payload: Record<string, unknown>;
};

function resolveReference(input: LocalWalletSettlementInput): string | null {
  const direct = input.externalReference?.trim();
  if (direct) return direct;

  const metadata = input.payload.metadata as Record<string, unknown> | undefined;
  const candidates = [
    input.payload.paymentIntentId,
    input.payload.depositId,
    input.payload.cartBatchId,
    input.payload.reference,
    input.payload.external_reference,
    metadata?.paymentIntentId,
    metadata?.depositId,
    metadata?.cartBatchId
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

/**
 * Mercado Pago / MODO: fiat settles at the wallet provider; queue treasury USDC delivery.
 */
export async function dispatchApprovedLocalWalletPayment(input: LocalWalletSettlementInput) {
  const reference = resolveReference(input);
  if (!reference) {
    return { ok: true, ignored: 'missing_reference' };
  }

  const amountUsd =
    typeof input.amountUsd === 'number' && Number.isFinite(input.amountUsd)
      ? input.amountUsd
      : typeof input.payload.amountUsd === 'number'
        ? input.payload.amountUsd
        : typeof input.payload.transaction_amount === 'number'
          ? input.payload.transaction_amount
          : typeof input.payload.amount === 'number'
            ? input.payload.amount
            : undefined;

  const result = await dispatchFiatRailTreasuryWebhook({
    externalReference: reference,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId ?? reference,
    paid: true,
    failed: false,
    treasuryTxnHash: null,
    payload: {
      ...input.payload,
      ...(amountUsd !== undefined ? { amountUsd } : {})
    }
  });

  let userId: string | null = null;
  let userEmail: string | null = null;
  let conversionAmount = amountUsd ?? 0;

  const deposit = await prisma.platformDeposit.findUnique({
    where: { id: reference },
    select: { userId: true, amountUsd: true }
  });
  if (deposit) {
    userId = deposit.userId;
    conversionAmount = amountUsd ?? deposit.amountUsd.toNumber();
  } else {
    const intent = await prisma.paymentIntent.findFirst({
      where: {
        OR: [{ id: reference }, { metadata: { path: ['cartBatchId'], equals: reference } }]
      },
      select: { userId: true, amountUsd: true }
    });
    if (intent) {
      userId = intent.userId;
      conversionAmount = amountUsd ?? intent.amountUsd.toNumber();
    }
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    userEmail = user?.email ?? null;
  }

  if (userId && conversionAmount > 0) {
    try {
      await enqueueFiatToUsdcConversion({
        externalReference: reference,
        provider: input.provider,
        amountUsd: conversionAmount,
        userId,
        userEmail
      });
    } catch (error) {
      console.error('[dispatchApprovedLocalWalletPayment] conversion enqueue failed', error);
    }
  }

  if (userId) {
    await recordFiatIdentityFromPayload(userId, input.provider, input.payload, reference);
  }

  return result;
}

/** Best-effort capture of the fiat "wallet" identity (e.g. MP payer) seen in an approved payment. */
async function recordFiatIdentityFromPayload(
  userId: string,
  provider: string,
  payload: Record<string, unknown>,
  capturedFrom: string
): Promise<void> {
  const payer = payload.payer as { id?: string | number; email?: string } | null | undefined;
  const identifier = payer?.email?.trim() || (payer?.id != null ? String(payer.id) : null);

  if (!identifier) {
    return;
  }

  try {
    await linkFiatIdentity({
      userId,
      provider,
      identifier,
      label: payer?.email ?? null,
      capturedFrom
    });
  } catch (error) {
    console.error('[dispatchApprovedLocalWalletPayment] linkFiatIdentity failed', error);
  }
}
