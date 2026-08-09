import { describe, expect, it } from 'vitest';
import { recommendCheckoutRails } from './checkoutRailPolicy';

describe('recommendCheckoutRails', () => {
  it('keeps Argentina on Macro/MP/Ripio/crypto', () => {
    const ar = recommendCheckoutRails('AR');
    expect(ar.primary).toContain('fiat_wallet_ar');
    expect(ar.primary).toContain('macro_card');
    expect(ar.primary).toContain('macro_wire');
    expect(ar.primary).toContain('crypto_usdc');
    expect(ar.primary).not.toContain('bridge_wire');
  });

  it('prefers Bridge wire for US/EU/BR/MX', () => {
    expect(recommendCheckoutRails('US').primary).toContain('bridge_wire');
    expect(recommendCheckoutRails('EU').primary).toContain('bridge_wire');
    expect(recommendCheckoutRails('BR').primary).toContain('bridge_wire');
    expect(recommendCheckoutRails('MX').primary).toContain('bridge_wire');
  });

  /**
   * Advertising a fiat rail where neither Macro nor Bridge collects would send an
   * investor into a checkout that cannot be completed.
   */
  it('recommends only USDC where no collector reaches', () => {
    const jp = recommendCheckoutRails('JP');
    expect(jp.primary).toEqual(['crypto_usdc']);
  });
});
