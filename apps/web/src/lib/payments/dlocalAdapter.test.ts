import { describe, expect, it } from 'vitest';
import { mapDLocalPaymentMethodId, resolveDLocalChargeAmount } from './dlocalPaymentMethods';

describe('dlocalPaymentMethods', () => {
  it('maps Argentina catalog rails to dLocal payment_method_id', () => {
    expect(mapDLocalPaymentMethodId('AR', 'modo_qr')).toBe('MU');
    expect(mapDLocalPaymentMethodId('AR', 'bank_transfer_ar')).toBe('IO');
    expect(mapDLocalPaymentMethodId('AR', 'card')).toBe('CARD');
    expect(mapDLocalPaymentMethodId('AR', 'wallet')).toBe('QR');
  });

  it('charges Argentina in ARS using configured FX', () => {
    const charge = resolveDLocalChargeAmount('AR', 100);
    expect(charge.currency).toBe('ARS');
    expect(charge.amount).toBe(105000);
  });
});
