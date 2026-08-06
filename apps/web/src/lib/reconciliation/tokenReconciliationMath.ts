/**
 * Pure token/share accounting used by the reconciliation report.
 *
 * One RWA token is one vault share, but not one fixed number of wei: an
 * ERC-4626 vault's share decimals are the asset's plus its `_decimalsOffset`,
 * and that offset was raised to 3 as an inflation-attack mitigation. So the
 * decimals belong to the vault being read, and this file will not guess them —
 * a report that silently multiplies a holding by a thousand is worse than one
 * that says it could not read the vault.
 */

/** The asset token's decimals, which a vault with no offset also reports. */
export const DEFAULT_SHARE_DECIMALS = 18;

export type ReconcileStatus = 'MATCH' | 'SHORT_ONCHAIN' | 'EXTRA_ONCHAIN' | 'UNKNOWN';

/** Whole tokens represented by a raw share amount, in the vault's own units. */
export function sharesToTokens(
  rawShares: string | bigint | null | undefined,
  shareDecimals: number | null | undefined
): number | null {
  if (rawShares === null || rawShares === undefined || rawShares === '') return null;
  if (shareDecimals === null || shareDecimals === undefined || !Number.isInteger(shareDecimals)) {
    return null;
  }
  try {
    const value = typeof rawShares === 'bigint' ? rawShares : BigInt(rawShares);
    // Keep 6 decimals of a token so partial shares are visible instead of rounded away.
    const scaled = (value * 1_000_000n) / 10n ** BigInt(shareDecimals);
    return Number(scaled) / 1_000_000;
  } catch {
    return null;
  }
}

export function tokensToShares(tokenCount: number, shareDecimals: number): bigint {
  if (!Number.isFinite(tokenCount) || tokenCount <= 0) return 0n;
  if (!Number.isInteger(shareDecimals) || shareDecimals < 0) return 0n;
  return BigInt(Math.round(tokenCount)) * 10n ** BigInt(shareDecimals);
}

/**
 * Compare booked (DB) tokens against on-chain tokens.
 * `toleranceTokens` absorbs share rounding, never real gaps.
 */
export function compareHolding(input: {
  bookedTokens: number;
  onChainTokens: number | null;
  toleranceTokens?: number;
}): { status: ReconcileStatus; deltaTokens: number | null } {
  if (input.onChainTokens === null) {
    return { status: 'UNKNOWN', deltaTokens: null };
  }

  const tolerance = input.toleranceTokens ?? 1e-6;
  const delta = Number((input.onChainTokens - input.bookedTokens).toFixed(6));

  if (Math.abs(delta) <= tolerance) {
    return { status: 'MATCH', deltaTokens: 0 };
  }
  return { status: delta < 0 ? 'SHORT_ONCHAIN' : 'EXTRA_ONCHAIN', deltaTokens: delta };
}

export type TreasuryCoverage = {
  pendingDeliveryTokens: number;
  treasuryTokens: number | null;
  /** Tokens the treasury is short of to honour pending deliveries. */
  shortfallTokens: number | null;
  covered: boolean | null;
};

/**
 * Can the treasury still deliver every confirmed-but-undelivered purchase?
 * Investors already paid for these, so a shortfall is an obligation, not a warning.
 */
export function auditTreasuryCoverage(input: {
  pendingDeliveryTokens: number;
  treasuryTokens: number | null;
}): TreasuryCoverage {
  if (input.treasuryTokens === null) {
    return {
      pendingDeliveryTokens: input.pendingDeliveryTokens,
      treasuryTokens: null,
      shortfallTokens: null,
      covered: null
    };
  }

  const shortfall = Number(
    Math.max(0, input.pendingDeliveryTokens - input.treasuryTokens).toFixed(6)
  );
  return {
    pendingDeliveryTokens: input.pendingDeliveryTokens,
    treasuryTokens: input.treasuryTokens,
    shortfallTokens: shortfall,
    covered: shortfall <= 1e-6
  };
}

export type ProjectSupplyReconciliation = {
  totalTokens: number;
  availableTokens: number;
  /** Supply the DB says is placed (total − available). */
  soldByAvailability: number;
  /** Sum of ACTIVE investments. */
  bookedByInvestments: number;
  /** total − available must equal booked investments. */
  supplyDeltaTokens: number;
  supplyStatus: ReconcileStatus;
  /** Shares still sitting in treasury, in tokens. */
  treasuryTokens: number | null;
  /** Shares delivered to investors, in tokens (vault supply − treasury). */
  investorTokensOnChain: number | null;
  onChainDeltaTokens: number | null;
  onChainStatus: ReconcileStatus;
};

/**
 * Reconcile a project's token supply across three sources:
 * `availableTokens`, booked `Investment` rows and on-chain vault shares.
 */
export function reconcileProjectSupplyMath(input: {
  totalTokens: number;
  availableTokens: number;
  bookedByInvestments: number;
  vaultTotalSupplyShares?: string | null;
  treasuryShares?: string | null;
  /** Read from the vault. Without it the on-chain comparison stays UNKNOWN. */
  shareDecimals?: number | null;
}): ProjectSupplyReconciliation {
  const soldByAvailability = input.totalTokens - input.availableTokens;
  const supplyDeltaTokens = Number((soldByAvailability - input.bookedByInvestments).toFixed(6));
  const supplyStatus: ReconcileStatus =
    Math.abs(supplyDeltaTokens) <= 1e-6
      ? 'MATCH'
      : supplyDeltaTokens > 0
        ? 'SHORT_ONCHAIN'
        : 'EXTRA_ONCHAIN';

  const totalSupplyTokens = sharesToTokens(
    input.vaultTotalSupplyShares ?? null,
    input.shareDecimals
  );
  const treasuryTokens = sharesToTokens(input.treasuryShares ?? null, input.shareDecimals);
  const investorTokensOnChain =
    totalSupplyTokens !== null && treasuryTokens !== null
      ? Number((totalSupplyTokens - treasuryTokens).toFixed(6))
      : null;

  const onChain = compareHolding({
    bookedTokens: input.bookedByInvestments,
    onChainTokens: investorTokensOnChain
  });

  return {
    totalTokens: input.totalTokens,
    availableTokens: input.availableTokens,
    soldByAvailability,
    bookedByInvestments: input.bookedByInvestments,
    supplyDeltaTokens,
    supplyStatus,
    treasuryTokens,
    investorTokensOnChain,
    onChainDeltaTokens: onChain.deltaTokens,
    onChainStatus: onChain.status
  };
}
