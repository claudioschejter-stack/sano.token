import { compareHolding, sharesToTokens } from '../reconciliation/tokenReconciliationMath';

export type OnChainHoldingBadge = {
  /** Tokens actually held by the wallet on-chain. */
  onChainTokens: number | null;
  /** Booked matches chain — safe to show a verified check. */
  verified: boolean;
  /** Booked > chain: delivery still pending (never show as verified). */
  pendingDelivery: boolean;
};

/**
 * Turns portfolio position metadata into an on-chain verification badge so
 * "Mis Activos" shows the wallet's real token balance, not only booked rows.
 */
export function onChainHoldingBadge(input: {
  bookedTokens: number;
  metadata?: Record<string, unknown> | null;
}): OnChainHoldingBadge {
  const metadata = input.metadata ?? {};
  const rawShares =
    typeof metadata.vaultShares === 'string' || typeof metadata.vaultShares === 'number'
      ? String(metadata.vaultShares)
      : null;
  /**
   * Recorded next to the shares by whoever read them. Without it the badge
   * cannot say anything, and claiming "verified" from a guessed unit is exactly
   * the failure this badge exists to catch.
   */
  const shareDecimals =
    typeof metadata.vaultShareDecimals === 'number' ? metadata.vaultShareDecimals : null;
  const onChainTokens = sharesToTokens(rawShares, shareDecimals);
  const { status } = compareHolding({ bookedTokens: input.bookedTokens, onChainTokens });

  return {
    onChainTokens,
    verified: status === 'MATCH' && onChainTokens !== null && onChainTokens > 0,
    pendingDelivery: status === 'SHORT_ONCHAIN'
  };
}
