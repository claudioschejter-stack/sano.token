import { describe, expect, it } from 'vitest';
import { isExternalUsdcPaymentOptionId } from './externalUsdcPaymentOptions';

describe('isExternalUsdcPaymentOptionId', () => {
  it('accepts Coinbase / WC / MetaMask / Binance wallet options', () => {
    expect(isExternalUsdcPaymentOptionId('walletconnect_usdc')).toBe(true);
    expect(isExternalUsdcPaymentOptionId('electronic_wallet')).toBe(true);
    expect(isExternalUsdcPaymentOptionId('metamask_usdc')).toBe(true);
    expect(isExternalUsdcPaymentOptionId('binance_usdc')).toBe(true);
  });

  it('rejects Sanova-linked or fiat options', () => {
    expect(isExternalUsdcPaymentOptionId('privy_usdc')).toBe(false);
    expect(isExternalUsdcPaymentOptionId('privy_on_ramp')).toBe(false);
    expect(isExternalUsdcPaymentOptionId(null)).toBe(false);
  });
});
