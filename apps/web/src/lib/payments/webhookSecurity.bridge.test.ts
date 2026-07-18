import { createHmac, createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyBridgeWebhookSignature } from './webhookSecurity';

describe('verifyBridgeWebhookSignature', () => {
  it('accepts a valid Bridge RSA v0 signature', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const payload = JSON.stringify({ event_type: 'transfer.updated', event_object: { id: 'tr_1' } });
    const timestamp = String(Date.now());
    const signer = createSign('SHA256');
    signer.update(`${timestamp}.${payload}`);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');
    const header = `t=${timestamp},v0=${signature}`;

    expect(
      verifyBridgeWebhookSignature({
        payload,
        signature: header,
        publicKey
      })
    ).toBe(true);
  });

  it('rejects tampered payloads', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const payload = JSON.stringify({ event_type: 'transfer.updated' });
    const timestamp = String(Date.now());
    const signer = createSign('SHA256');
    signer.update(`${timestamp}.${payload}`);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');

    expect(
      verifyBridgeWebhookSignature({
        payload: '{"event_type":"transfer.hacked"}',
        signature: `t=${timestamp},v0=${signature}`,
        publicKey
      })
    ).toBe(false);
  });

  it('falls back to legacy HMAC when no RSA public key is provided', () => {
    const payload = '{"ok":true}';
    const secret = 'test-secret';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    expect(
      verifyBridgeWebhookSignature({
        payload,
        signature,
        legacyHmacSecret: secret
      })
    ).toBe(true);
  });
});
