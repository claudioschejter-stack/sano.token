import { describe, expect, it } from 'vitest';
import { fixedUsdPriceToMorphoOraclePrice } from '../blockchain/pricingOracleValidation';
import { usdPriceToNavPerAssetMicroUsd, auditDocumentToHash, shouldUseNavOracle } from '../blockchain/navOracleService';

describe('navOracleService', () => {
  it('converts USD price to NAV micro-units', () => {
    expect(usdPriceToNavPerAssetMicroUsd(20)).toBe(20_000_000n);
    expect(usdPriceToNavPerAssetMicroUsd(0)).toBeNull();
  });

  it('derives Morpho-compatible price from NAV per asset', () => {
    const microUsd = usdPriceToNavPerAssetMicroUsd(20)!;
    const morphoPrice = microUsd * 10n ** 18n;
    expect(morphoPrice).toBe(fixedUsdPriceToMorphoOraclePrice(20));
  });

  it('hashes audit documents deterministically', () => {
    expect(auditDocumentToHash('audit-q1-2026')).toHaveLength(66);
    expect(auditDocumentToHash('audit-q1-2026')).toBe(auditDocumentToHash('audit-q1-2026'));
  });

  it('defaults to NAV oracle unless MORPHO_ORACLE_TYPE=fixed', () => {
    const previous = process.env.MORPHO_ORACLE_TYPE;
    delete process.env.MORPHO_ORACLE_TYPE;
    expect(shouldUseNavOracle()).toBe(true);
    process.env.MORPHO_ORACLE_TYPE = 'fixed';
    expect(shouldUseNavOracle()).toBe(false);
    if (previous) process.env.MORPHO_ORACLE_TYPE = previous;
    else delete process.env.MORPHO_ORACLE_TYPE;
  });
});
