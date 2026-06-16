import { describe, expect, it, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyCoinbaseSignature,
  verifyHmacSignature,
  verifyMercadoPagoSignature,
  verifySharedSecret,
  verifyStripeSignature
} from './webhookSecurity';

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe('webhookSecurity', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    setEnv('NODE_ENV', originalNodeEnv);
    setEnv('VERCEL_ENV', originalVercelEnv);
  });

  it('rejects missing secrets in production', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('VERCEL_ENV', 'production');

    expect(verifyHmacSignature({ secret: '', payload: '{}', signature: 'abc' })).toBe(false);
    expect(verifySharedSecret({ secret: '', provided: 'abc' })).toBe(false);
  });

  it('allows missing secrets in development', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('VERCEL_ENV', 'development');

    expect(verifyHmacSignature({ secret: '', payload: '{}', signature: null })).toBe(true);
    expect(verifySharedSecret({ secret: '', provided: null })).toBe(true);
  });

  it('validates stripe signatures', () => {
    const secret = 'whsec_test';
    const payload = '{"id":"evt_1"}';
    const timestamp = '1710000000';
    const digest = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');

    expect(
      verifyStripeSignature({
        secret,
        payload,
        signature: `t=${timestamp},v1=${digest}`
      })
    ).toBe(true);
  });

  it('validates hmac signatures', () => {
    const secret = 'shared-secret';
    const payload = '{"ok":true}';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    expect(verifyHmacSignature({ secret, payload, signature })).toBe(true);
    expect(verifyCoinbaseSignature({ secret, payload, signature })).toBe(true);
  });

  it('validates mercado pago signatures', () => {
    const secret = 'mp-webhook-secret';
    const dataId = '123456';
    const requestId = 'req-abc';
    const timestamp = '1710000000';
    const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
    const digest = createHmac('sha256', secret).update(manifest).digest('hex');

    expect(
      verifyMercadoPagoSignature({
        secret,
        signature: `ts=${timestamp},v1=${digest}`,
        requestId,
        dataId
      })
    ).toBe(true);
  });
});
