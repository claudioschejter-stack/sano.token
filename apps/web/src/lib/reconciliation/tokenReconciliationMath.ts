/**
 * Pure token/share accounting used by the reconciliation report.
 * Vault shares use 18 decimals; 1 RWA token = 1e18 shares.
 */

export const SHARE_DECIMALS = 18;
const SHARE_UNIT = 10n ** BigInt(SHARE_DECIMALS);

export type ReconcileStatus = 'MATCH' | 'SHORT_ONCHAIN' | 'EXTRA_ONCHAIN' | 'UNKNOWN';

/** Whole tokens represented by a raw share amount (string wei-like value). */
export function sharesToTokens(rawShares: string | bigint | null | undefined): number | null {
  if (rawShares === null || rawShares === undefined || rawShares === '') return null;
  try {
    const value = typeof rawShares === 'bigint' ? rawShares : BigInt(rawShares);
    // Keep 6 decimals of a token so partial shares are visible instead of rounded away.
    const scaled = (value * 1_000_000n) / SHARE_UNIT;
    return Number(scaled) / 1_000_000;
  } catch {
    return null;
  }
}

export function tokensToShares(tokenCount: number): bigint {
  if (!Number.isFinite(tokenCount) || tokenCount <= 0) return 0n;
  return BigInt(Math.round(tokenCount)) * SHARE_UNIT;
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
}): ProjectSupplyReconciliation {
  const soldByAvailability = input.totalTokens - input.availableTokens;
  const supplyDeltaTokens = Number((soldByAvailability - input.bookedByInvestments).toFixed(6));
  const supplyStatus: ReconcileStatus =
    Math.abs(supplyDeltaTokens) <= 1e-6
      ? 'MATCH'
      : supplyDeltaTokens > 0
        ? 'SHORT_ONCHAIN'
        : 'EXTRA_ONCHAIN';

  const totalSupplyTokens = sharesToTokens(input.vaultTotalSupplyShares ?? null);
  const treasuryTokens = sharesToTokens(input.treasuryShares ?? null);
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
