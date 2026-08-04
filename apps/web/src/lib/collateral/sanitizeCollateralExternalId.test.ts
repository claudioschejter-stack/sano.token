import { describe, expect, it } from 'vitest';
import { sanitizeCollateralExternalId } from './sanitizeCollateralExternalId';

const REAL_MARKET_ID = '0xacc94a3f8cf6c3bd4060d02a2888027540db4a147dc2d7249472b1623d102209';

describe('sanitizeCollateralExternalId', () => {
  it('keeps a real Morpho market id', () => {
    expect(sanitizeCollateralExternalId('MORPHO', REAL_MARKET_ID)).toBe(REAL_MARKET_ID);
  });

  it('drops the placeholders adapters used to invent', () => {
    expect(sanitizeCollateralExternalId('MORPHO', 'MORPHO-proj-anelo')).toBeNull();
    expect(sanitizeCollateralExternalId('MORPHO', 'MORPHO-MARKET-proj-anelo')).toBeNull();
    expect(sanitizeCollateralExternalId('MORPHO', 'SANOVA-MORPHO-proj-anelo')).toBeNull();
  });

  it('drops a value that is the right shape but not a market id', () => {
    expect(sanitizeCollateralExternalId('MORPHO', '0x1234')).toBeNull();
  });

  it('leaves other protocols alone, where the id is not a market id', () => {
    expect(sanitizeCollateralExternalId('AAVE', 'SANOVA-AAVE-proj-1')).toBe('SANOVA-AAVE-proj-1');
  });

  it('normalises an empty value to null', () => {
    expect(sanitizeCollateralExternalId('MORPHO', '   ')).toBeNull();
    expect(sanitizeCollateralExternalId('MORPHO', null)).toBeNull();
    expect(sanitizeCollateralExternalId('MORPHO', undefined)).toBeNull();
  });
});
