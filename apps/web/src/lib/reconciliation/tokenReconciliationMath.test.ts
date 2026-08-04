import { describe, expect, it } from 'vitest';
import {
  auditTreasuryCoverage,
  compareHolding,
  reconcileProjectSupplyMath,
  sharesToTokens,
  tokensToShares
} from './tokenReconciliationMath';

describe('auditTreasuryCoverage', () => {
  it('covers pending deliveries when treasury holds enough shares', () => {
    expect(auditTreasuryCoverage({ pendingDeliveryTokens: 3, treasuryTokens: 10 })).toEqual({
      pendingDeliveryTokens: 3,
      treasuryTokens: 10,
      shortfallTokens: 0,
      covered: true
    });
  });

  it('reports the shortfall when investors paid for more than treasury holds', () => {
    expect(auditTreasuryCoverage({ pendingDeliveryTokens: 12, treasuryTokens: 4 })).toEqual({
      pendingDeliveryTokens: 12,
      treasuryTokens: 4,
      shortfallTokens: 8,
      covered: false
    });
  });

  it('stays unknown when treasury shares could not be read', () => {
    expect(auditTreasuryCoverage({ pendingDeliveryTokens: 1, treasuryTokens: null })).toEqual({
      pendingDeliveryTokens: 1,
      treasuryTokens: null,
      shortfallTokens: null,
      covered: null
    });
  });
});

describe('sharesToTokens', () => {
  it('converts 18-decimal shares to whole tokens', () => {
    expect(sharesToTokens('1000000000000000000')).toBe(1);
    expect(sharesToTokens('2500000000000000000')).toBe(2.5);
    expect(sharesToTokens(0n)).toBe(0);
  });

  it('returns null for unknown values', () => {
    expect(sharesToTokens(null)).toBeNull();
    expect(sharesToTokens('not-a-number')).toBeNull();
  });
});

describe('tokensToShares', () => {
  it('round-trips token counts', () => {
    expect(tokensToShares(3)).toBe(3_000000000000000000n);
    expect(sharesToTokens(tokensToShares(7))).toBe(7);
    expect(tokensToShares(0)).toBe(0n);
  });
});

describe('compareHolding', () => {
  it('matches when on-chain equals booked', () => {
    expect(compareHolding({ bookedTokens: 1, onChainTokens: 1 })).toEqual({
      status: 'MATCH',
      deltaTokens: 0
    });
  });

  it('flags investor missing tokens on-chain', () => {
    expect(compareHolding({ bookedTokens: 2, onChainTokens: 1 })).toEqual({
      status: 'SHORT_ONCHAIN',
      deltaTokens: -1
    });
  });

  it('flags extra tokens on-chain (untracked delivery)', () => {
    expect(compareHolding({ bookedTokens: 1, onChainTokens: 3 })).toEqual({
      status: 'EXTRA_ONCHAIN',
      deltaTokens: 2
    });
  });

  it('reports UNKNOWN when the chain could not be read', () => {
    expect(compareHolding({ bookedTokens: 1, onChainTokens: null })).toEqual({
      status: 'UNKNOWN',
      deltaTokens: null
    });
  });
});

describe('reconcileProjectSupplyMath', () => {
  it('matches when availability, investments and chain agree', () => {
    const result = reconcileProjectSupplyMath({
      totalTokens: 5000,
      availableTokens: 4986,
      bookedByInvestments: 14,
      vaultTotalSupplyShares: (5000n * 10n ** 18n).toString(),
      treasuryShares: (4986n * 10n ** 18n).toString()
    });

    expect(result.soldByAvailability).toBe(14);
    expect(result.supplyStatus).toBe('MATCH');
    expect(result.investorTokensOnChain).toBe(14);
    expect(result.onChainStatus).toBe('MATCH');
  });

  it('detects reserved-but-unbooked supply', () => {
    const result = reconcileProjectSupplyMath({
      totalTokens: 5000,
      availableTokens: 4985,
      bookedByInvestments: 14
    });

    expect(result.soldByAvailability).toBe(15);
    expect(result.supplyDeltaTokens).toBe(1);
    expect(result.supplyStatus).toBe('SHORT_ONCHAIN');
    expect(result.onChainStatus).toBe('UNKNOWN');
  });

  it('detects investors holding fewer shares than booked', () => {
    const result = reconcileProjectSupplyMath({
      totalTokens: 5000,
      availableTokens: 4986,
      bookedByInvestments: 14,
      vaultTotalSupplyShares: (5000n * 10n ** 18n).toString(),
      treasuryShares: (4990n * 10n ** 18n).toString()
    });

    expect(result.investorTokensOnChain).toBe(10);
    expect(result.onChainDeltaTokens).toBe(-4);
    expect(result.onChainStatus).toBe('SHORT_ONCHAIN');
  });
});
