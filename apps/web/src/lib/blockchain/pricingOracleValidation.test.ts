import { describe, expect, it } from 'vitest';
import { fixedUsdPriceToMorphoOraclePrice } from './pricingOracleValidation';

/**
 * Morpho values collateral as `amount * price / 1e36`, so the only thing worth
 * asserting is what it would compute: one whole share has to come out at the
 * quoted price.
 *
 * The old constant folded in 18 decimals. It was right for vaults deployed
 * before the inflation-attack offset and, on any later vault, would have valued
 * a share a thousand times too high — the dangerous direction, since it lets an
 * investor borrow far past what the collateral is worth.
 */
describe('fixedUsdPriceToMorphoOraclePrice', () => {
  const valueOfOneWholeShare = (price: bigint, decimals: number) =>
    (10n ** BigInt(decimals) * price) / 10n ** 36n;

  it('quotes $20 per share on a vault deployed before the offset', () => {
    const price = fixedUsdPriceToMorphoOraclePrice(20, 18)!;
    expect(valueOfOneWholeShare(price, 18)).toBe(20_000_000n);
  });

  it('quotes $20 per share on a vault carrying the offset', () => {
    const price = fixedUsdPriceToMorphoOraclePrice(20, 21)!;
    expect(valueOfOneWholeShare(price, 21)).toBe(20_000_000n);
  });

  it('would have overvalued the offset vault a thousandfold with the old scale', () => {
    // The old formula always returned the 18-decimal price.
    const legacy = fixedUsdPriceToMorphoOraclePrice(20, 18)!;
    expect(valueOfOneWholeShare(legacy, 21)).toBe(20_000_000_000n);
  });

  it('keeps the 18-decimal default so existing callers are unchanged', () => {
    expect(fixedUsdPriceToMorphoOraclePrice(20)).toBe(fixedUsdPriceToMorphoOraclePrice(20, 18));
  });

  it('refuses a price or a unit it cannot scale', () => {
    expect(fixedUsdPriceToMorphoOraclePrice(0, 18)).toBeNull();
    expect(fixedUsdPriceToMorphoOraclePrice(20, -1)).toBeNull();
    expect(fixedUsdPriceToMorphoOraclePrice(20, 40)).toBeNull();
  });
});
