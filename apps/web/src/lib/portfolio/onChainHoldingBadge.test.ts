import { describe, expect, it } from 'vitest';
import { onChainHoldingBadge } from './onChainHoldingBadge';

const shares = (tokens: number) => (BigInt(tokens) * 10n ** 18n).toString();

describe('onChainHoldingBadge', () => {
  it('verifies when wallet shares match booked tokens', () => {
    expect(
      onChainHoldingBadge({ bookedTokens: 2, metadata: { vaultShares: shares(2) } })
    ).toEqual({ onChainTokens: 2, verified: true, pendingDelivery: false });
  });

  it('flags pending delivery when the wallet holds less', () => {
    expect(
      onChainHoldingBadge({ bookedTokens: 3, metadata: { vaultShares: shares(1) } })
    ).toEqual({ onChainTokens: 1, verified: false, pendingDelivery: true });
  });

  it('is not verified when shares are zero', () => {
    expect(onChainHoldingBadge({ bookedTokens: 1, metadata: { vaultShares: '0' } })).toEqual({
      onChainTokens: 0,
      verified: false,
      pendingDelivery: true
    });
  });

  it('stays neutral when the chain could not be read', () => {
    expect(onChainHoldingBadge({ bookedTokens: 1, metadata: {} })).toEqual({
      onChainTokens: null,
      verified: false,
      pendingDelivery: false
    });
  });
});
