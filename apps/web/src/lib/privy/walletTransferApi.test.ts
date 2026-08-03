import { describe, expect, it } from 'vitest';
import { formatPrivyUsdcAmount } from './walletTransferApi';

describe('formatPrivyUsdcAmount', () => {
  it('formats whole dollars with a trailing .0', () => {
    expect(formatPrivyUsdcAmount(20)).toBe('20.0');
  });

  it('preserves meaningful decimals up to 6 places', () => {
    expect(formatPrivyUsdcAmount(20.5)).toBe('20.5');
    expect(formatPrivyUsdcAmount(20.123456)).toBe('20.123456');
  });

  it('rejects non-positive amounts', () => {
    expect(() => formatPrivyUsdcAmount(0)).toThrow('PRIVY_TRANSFER_AMOUNT_INVALID');
    expect(() => formatPrivyUsdcAmount(-1)).toThrow('PRIVY_TRANSFER_AMOUNT_INVALID');
  });
});
