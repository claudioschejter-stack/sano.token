import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isMercadoPagoQrConfigured,
  mercadoPagoQrDefaultMode,
  mercadoPagoQrExternalPosId
} from './config';

describe('mercadoPagoQr config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads MP_* env vars with MERCADOPAGO_* fallback', () => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'APP_USR-test-token');
    vi.stubEnv('MP_EXTERNAL_POS_ID', 'STORE001POS001');
    vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', '');
    vi.stubEnv('MERCADOPAGO_EXTERNAL_POS_ID', '');

    expect(mercadoPagoQrExternalPosId()).toBe('STORE001POS001');
    expect(isMercadoPagoQrConfigured()).toBe(true);
  });

  it('defaults QR mode to dynamic', () => {
    delete process.env.MP_QR_DEFAULT_MODE;
    expect(mercadoPagoQrDefaultMode()).toBe('dynamic');
  });

  it('is not configured without external pos id', () => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'APP_USR-test-token');
    vi.stubEnv('MP_EXTERNAL_POS_ID', '');
    expect(isMercadoPagoQrConfigured()).toBe(false);
  });
});
