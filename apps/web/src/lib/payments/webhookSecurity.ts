import { createHmac, timingSafeEqual } from 'node:crypto';
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
