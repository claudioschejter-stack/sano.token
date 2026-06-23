import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMercadoPagoDirectPreference } from './mercadoPagoDirectCheckoutService';

describe('createMercadoPagoDirectPreference', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'TEST-access-token-1234567890123456789012345678901234567890');
    vi.stubEnv('NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY', 'TEST-public-key');
    vi.stubEnv('MERCADOPAGO_FX_ARS', '1050');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.sanovacapital.com');
  });

  it('returns init_point and preference id from Mercado Pago API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: 'pref-123',
          init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-123',
          sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-123'
        })
      })) as unknown as typeof fetch
    );

    const result = await createMercadoPagoDirectPreference({
      amountUsd: 100,
      externalReference: 'order-1',
      country: 'AR'
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.preferenceId).toBe('pref-123');
      expect(result.session.initPoint).toContain('pref-123');
      expect(result.session.amountLocal).toBe(105000);
      expect(result.session.localCurrency).toBe('ARS');
    }
  });
});
