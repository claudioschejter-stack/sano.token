import { describe, expect, it } from 'vitest';
import { onChainHoldingBadge } from './onChainHoldingBadge';

const holding = (tokens: number, decimals = 18) => ({
  vaultShares: (BigInt(tokens) * 10n ** BigInt(decimals)).toString(),
  vaultShareDecimals: decimals
});

describe('onChainHoldingBadge', () => {
  it('verifies when wallet shares match booked tokens', () => {
    expect(onChainHoldingBadge({ bookedTokens: 2, metadata: holding(2) })).toEqual({
      onChainTokens: 2,
      verified: true,
      pendingDelivery: false
    });
  });

  /** Same holding, a vault carrying the offset: still two tokens, not two thousand. */
  it('verifies the same holding on a vault with 21-decimal shares', () => {
    expect(onChainHoldingBadge({ bookedTokens: 2, metadata: holding(2, 21) })).toEqual({
      onChainTokens: 2,
      verified: true,
      pendingDelivery: false
    });
  });

  it('flags pending delivery when the wallet holds less', () => {
    expect(onChainHoldingBadge({ bookedTokens: 3, metadata: holding(1) })).toEqual({
      onChainTokens: 1,
      verified: false,
      pendingDelivery: true
    });
  });

  it('is not verified when shares are zero', () => {
    expect(
      onChainHoldingBadge({
        bookedTokens: 1,
        metadata: { vaultShares: '0', vaultShareDecimals: 18 }
      })
    ).toEqual({ onChainTokens: 0, verified: false, pendingDelivery: true });
  });

  it('stays neutral when the chain could not be read', () => {
    expect(onChainHoldingBadge({ bookedTokens: 1, metadata: {} })).toEqual({
      onChainTokens: null,
      verified: false,
      pendingDelivery: false
    });
  });

  /**
   * A holding recorded before the unit was tracked cannot be turned into a
   * verified check: claiming one from a guessed unit is the failure the badge is
   * supposed to catch.
   */
  it('refuses to verify a holding whose share unit was never recorded', () => {
    expect(
      onChainHoldingBadge({ bookedTokens: 2, metadata: { vaultShares: shareString(2) } })
    ).toEqual({ onChainTokens: null, verified: false, pendingDelivery: false });
  });
});

function shareString(tokens: number): string {
  return (BigInt(tokens) * 10n ** 18n).toString();
}
