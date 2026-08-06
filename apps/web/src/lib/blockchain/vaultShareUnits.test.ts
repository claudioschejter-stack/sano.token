import { describe, expect, it } from 'vitest';
import { vaultSharesForTokens } from './vaultShareUnits';

/**
 * The offset raised as an inflation-attack mitigation means vaults deployed
 * before and after it do not share a unit. Sizing a delivery with the wrong one
 * hands the investor a thousandth of what they paid for.
 */
describe('vaultSharesForTokens', () => {
  it('sizes against the vault that was deployed before the offset', () => {
    expect(vaultSharesForTokens(10, 18)).toBe(10n * 10n ** 18n);
  });

  it('sizes against a vault carrying the offset', () => {
    expect(vaultSharesForTokens(10, 21)).toBe(10n * 10n ** 21n);
  });

  it('never sizes a delivery from an invalid count', () => {
    expect(vaultSharesForTokens(0, 18)).toBe(0n);
    expect(vaultSharesForTokens(-1, 18)).toBe(0n);
    expect(vaultSharesForTokens(1.5, 18)).toBe(0n);
  });
});
