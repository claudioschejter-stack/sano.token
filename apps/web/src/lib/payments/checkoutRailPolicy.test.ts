import { describe, expect, it } from 'vitest';
import { recommendCheckoutRails } from './checkoutRailPolicy';

describe('recommendCheckoutRails', () => {
  it('keeps Argentina on MP/Ripio/crypto', () => {
    const ar = recommendCheckoutRails('AR');
    expect(ar.primary).toContain('fiat_wallet_ar');
    expect(ar.primary).toContain('crypto_usdc');
    expect(ar.primary).not.toContain('bridge_wire');
  });

  it('prefers Bridge wire for US/EU', () => {
    expect(recommendCheckoutRails('US').primary).toContain('bridge_wire');
    expect(recommendCheckoutRails('EU').primary).toContain('bridge_wire');
  });
});
