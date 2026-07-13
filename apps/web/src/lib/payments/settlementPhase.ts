export type SettlementPhase =
  | 'awaiting_payment'
  | 'fiat_paid'
  | 'awaiting_usdc'
  | 'confirmed'
  | 'rwa_delivered'
  | 'failed';

export function deriveSettlementPhase(input: {
  kind: 'deposit' | 'cart';
  depositStatus?: string | null;
  depositMetadata?: Record<string, unknown> | null;
  cartAllConfirmed?: boolean;
  cartIntents?: Array<{ status: string; metadata?: Record<string, unknown> | null }>;
}): SettlementPhase {
  if (input.kind === 'deposit') {
    const status = input.depositStatus ?? '';
    const meta = input.depositMetadata ?? {};
    if (status === 'CONFIRMED') return 'confirmed';
    if (status === 'FAILED' || status === 'EXPIRED') return 'failed';
    if (status === 'MANUAL_REVIEW' && meta.awaitingTreasuryUsdc) return 'awaiting_usdc';
    if (status === 'MANUAL_REVIEW') return 'fiat_paid';
    return 'awaiting_payment';
  }

  const intents = input.cartIntents ?? [];
  if (!intents.length) return 'awaiting_payment';
  if (input.cartAllConfirmed) {
    const delivered = intents.every((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return (
        meta.purchaseMode !== 'ERC4626_DEPOSIT' ||
        meta.vaultShareDeliveryStatus === 'DELIVERED' ||
        meta.vaultShareDeliveryStatus === 'DELIVERED_ONCHAIN'
      );
    });
    return delivered ? 'rwa_delivered' : 'confirmed';
  }
  if (intents.some((row) => row.status === 'FAILED')) return 'failed';
  if (
    intents.some((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return row.status === 'MANUAL_REVIEW' && meta.awaitingTreasuryUsdc === true;
    })
  ) {
    return 'awaiting_usdc';
  }
  if (intents.some((row) => row.status === 'MANUAL_REVIEW')) return 'fiat_paid';
  return 'awaiting_payment';
}
