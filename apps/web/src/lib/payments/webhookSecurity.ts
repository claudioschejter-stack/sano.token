import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyHmacSignature(input: {
  secret?: string;
  payload: string;
  signature?: string | null;
  prefix?: string;
}): boolean {
  if (!input.secret) {
    return true;
  }

  if (!input.signature) {
    return false;
  }

  const signature = input.prefix && input.signature.startsWith(input.prefix)
    ? input.signature.slice(input.prefix.length)
    : input.signature;
  const expected = createHmac('sha256', input.secret).update(input.payload).digest('hex');

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
  if (!input.secret) return true;
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

  const expected = createHmac('sha256', input.secret)
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
