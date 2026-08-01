import { describe, expect, it } from 'vitest';
import { toUsd, type MarketRatesSnapshot } from './marketRates';

const rates: MarketRatesSnapshot = {
  base: 'USD',
  fetchedAt: '2026-08-01T00:00:00.000Z',
  fiatUsdRates: { USD: 1, ARS: 1000, EUR: 0.9 },
  cryptoUsdPrices: { USDC: 1, USDT: 1, DAI: 1, USD: 1 }
};

describe('toUsd', () => {
  it('keeps USDC at 1:1 USD', () => {
    expect(toUsd(20, 'USDC', rates)).toBe(20);
  });

  it('converts ARS using USD→local rate', () => {
    expect(toUsd(2000, 'ARS', rates)).toBe(2);
  });
});
