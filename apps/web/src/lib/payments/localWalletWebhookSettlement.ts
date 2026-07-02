import { dispatchFiatRailTreasuryWebhook } from './fiatRailTreasurySettlement';

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

  return dispatchFiatRailTreasuryWebhook({
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
}
