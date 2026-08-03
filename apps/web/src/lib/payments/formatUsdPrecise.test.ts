import { describe, expect, it } from 'vitest';
import { formatUsdPrecise, roundUsdc } from './formatUsdPrecise';

describe('formatUsdPrecise', () => {
  it('keeps sub-cent gas in the total', () => {
    expect(formatUsdPrecise(20 + 0.000721)).toBe('20.000721');
    expect(formatUsdPrecise(20)).toBe('20.00');
    expect(formatUsdPrecise(0.000353)).toBe('0.000353');
  });

  it('rounds to USDC micros', () => {
    expect(roundUsdc(20.0007214)).toBe(20.000721);
  });
});
