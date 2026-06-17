import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatMercadoPagoBrickError,
  isMercadoPagoEmbeddedConfigured,
  isMercadoPagoEmbeddedResult,
  isMercadoPagoWalletOption,
  MERCADOPAGO_WALLET_OPTION_ID
} from './mercadoPagoEmbeddedService';

describe('mercadoPagoEmbeddedService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('detects wallet checkout option id', () => {
    expect(isMercadoPagoWalletOption(MERCADOPAGO_WALLET_OPTION_ID)).toBe(true);
    expect(isMercadoPagoWalletOption('mercado_pago')).toBe(false);
  });

  it('requires access token and public key for embedded config', () => {
    vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'APP_USR-1234567890123456-111111-abcdefghijklmnopqrstuvwxyz123456789012345678901234567890-123456789');
    vi.stubEnv('NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY', 'APP_USR-public-key');
    vi.stubEnv('MERCADOPAGO_EMBEDDED_CHECKOUT', 'true');

    expect(isMercadoPagoEmbeddedConfigured()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY', '');
    expect(isMercadoPagoEmbeddedConfigured()).toBe(false);
  });

  it('formats brick errors with cause and message', () => {
    expect(
      formatMercadoPagoBrickError({
        type: 'critical',
        cause: 'missing_amount_property',
        message: 'Amount property is required'
      })
    ).toBe('missing_amount_property: Amount property is required');
    expect(formatMercadoPagoBrickError('custom_error')).toBe('custom_error');
    expect(formatMercadoPagoBrickError({})).toBe('MERCADOPAGO_BRICK_ERROR');
  });

  it('recognizes embedded gateway metadata', () => {
    expect(
      isMercadoPagoEmbeddedResult({
        embedded: true,
        preferenceId: 'pref-1',
        publicKey: 'APP_USR-public-key',
        amount: 1050,
        currency: 'ARS',
        sandbox: true,
        walletOnly: true
      })
    ).toBe(true);
    expect(isMercadoPagoEmbeddedResult({ embedded: false })).toBe(false);
  });
});
