import { createHmac, createVerify, timingSafeEqual } from 'node:crypto';
import { isProductionRuntime } from '../runtime/environment';

function allowMissingWebhookSecret(): boolean {
  return !isProductionRuntime();
}

export function verifySharedSecret(input: {
  secret?: string | null;
  provided?: string | null;
}): boolean {
  const secret = input.secret?.trim();
  if (!secret) {
    return allowMissingWebhookSecret();
  }

  const provided = input.provided?.trim();
  if (!provided) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
  } catch {
    return false;
  }
}

export function verifyHmacSignature(input: {
  secret?: string;
  payload: string;
  signature?: string | null;
  prefix?: string;
}): boolean {
  const secret = input.secret?.trim();
  if (!secret) {
    return allowMissingWebhookSecret();
  }

  if (!input.signature) {
    return false;
  }

  const signature = input.prefix && input.signature.startsWith(input.prefix)
    ? input.signature.slice(input.prefix.length)
    : input.signature;
  const expected = createHmac('sha256', secret).update(input.payload).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function verifyStripeSignature(input: {
  secret?: string;
  payload: string;
  signature?: string | null;
}): boolean {
  const secret = input.secret?.trim();
  if (!secret) {
    return allowMissingWebhookSecret();
  }
  if (!input.signature) return false;

  const parts = Object.fromEntries(
    input.signature.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${input.payload}`)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function verifyCoinbaseSignature(input: {
  secret?: string;
  payload: string;
  signature?: string | null;
}): boolean {
  return verifyHmacSignature(input);
}

function normalizePemPublicKey(raw: string): string {
  let pem = raw.trim().replace(/^["']|["']$/g, '');
  if (pem.includes('\\n')) {
    pem = pem.replace(/\\n/g, '\n');
  }
  if (!pem.includes('BEGIN PUBLIC KEY')) {
    pem = `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
  }
  return pem;
}

/**
 * Bridge.xyz signs webhooks with per-endpoint RSA public keys:
 * header `X-Webhook-Signature: t=<ms>,v0=<base64>` over `${t}.${rawBody}`.
 * Falls back to legacy HMAC when only BRIDGE_WEBHOOK_SECRET is set (tests).
 */
export function verifyBridgeWebhookSignature(input: {
  payload: string;
  signature?: string | null;
  publicKey?: string | null;
  legacyHmacSecret?: string | null;
}): boolean {
  const header = input.signature?.trim();
  if (!header) {
    return allowMissingWebhookSecret() && !input.publicKey?.trim() && !input.legacyHmacSecret?.trim();
  }

  const publicKey = input.publicKey?.trim();
  if (publicKey && header.includes('v0=')) {
    try {
      const parts = Object.fromEntries(
        header.split(',').map((part) => {
          const idx = part.indexOf('=');
          return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
        })
      );
      const timestamp = parts.t;
      const signature = parts.v0;
      if (!timestamp || !signature) {
        return false;
      }
      const ageMs = Date.now() - Number(timestamp);
      if (!Number.isFinite(ageMs) || ageMs > 10 * 60 * 1000 || ageMs < -60_000) {
        return false;
      }
      const verifier = createVerify('SHA256');
      verifier.update(`${timestamp}.${input.payload}`);
      verifier.end();
      return verifier.verify(normalizePemPublicKey(publicKey), Buffer.from(signature, 'base64'));
    } catch {
      return false;
    }
  }

  return verifyHmacSignature({
    secret: input.legacyHmacSecret ?? undefined,
    payload: input.payload,
    signature: header
  });
}

/** Mercado Pago webhooks: manifest `id:...;request-id:...;ts:...;` signed with HMAC-SHA256. */
export function verifyMercadoPagoSignature(input: {
  secret?: string;
  signature?: string | null;
  requestId?: string | null;
  dataId?: string | null;
}): boolean {
  const secret = input.secret?.trim();
  if (!secret) {
    return allowMissingWebhookSecret();
  }

  if (!input.signature || !input.requestId || !input.dataId) {
    return false;
  }

  const parts = Object.fromEntries(
    input.signature.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key.trim(), value?.trim()];
    })
  );
  const timestamp = parts.ts;
  const providedHash = parts.v1;
  if (!timestamp || !providedHash) {
    return false;
  }

  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${timestamp};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(providedHash), Buffer.from(expected));
  } catch {
    return false;
  }
}
