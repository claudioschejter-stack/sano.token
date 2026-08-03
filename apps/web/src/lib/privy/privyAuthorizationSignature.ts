import canonicalize from 'canonicalize';
import crypto from 'crypto';
import { privyAppId } from './config';

/**
 * Builds Privy `privy-authorization-signature` for wallet requests.
 * Requires PRIVY_AUTHORIZATION_PRIVATE_KEY from Privy Dashboard → Authorization keys
 * (value may be prefixed with `wallet-auth:`).
 *
 * Uses RFC 8785 JSON canonicalization (`canonicalize`) — a hand-rolled serializer
 * can break Transfer API auth even when the quorum is already an additional signer.
 *
 * @see https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation
 */

export function isPrivyAuthorizationSigningConfigured(): boolean {
  return Boolean(process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY?.trim());
}

export function privyAuthorizationKeyQuorumId(): string {
  return process.env.PRIVY_AUTHORIZATION_KEY_QUORUM_ID?.trim() ?? '';
}

export function buildPrivyAuthorizationSignature(input: {
  url: string;
  body: Record<string, unknown>;
  idempotencyKey?: string;
}): string {
  const rawKey = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY?.trim();
  if (!rawKey) {
    throw new Error('PRIVY_AUTHORIZATION_PRIVATE_KEY_NOT_CONFIGURED');
  }

  const headers: Record<string, string> = {
    'privy-app-id': privyAppId()
  };
  if (input.idempotencyKey?.trim()) {
    headers['privy-idempotency-key'] = input.idempotencyKey.trim();
  }

  const payload = {
    version: 1,
    method: 'POST',
    url: input.url.replace(/\/$/, ''),
    body: input.body,
    headers
  };

  const serialized = canonicalize(payload);
  if (!serialized) {
    throw new Error('PRIVY_AUTHORIZATION_CANONICALIZE_FAILED');
  }

  const privateKeyAsString = rawKey.replace(/^wallet-auth:/, '').trim();
  const privateKeyAsPem = privateKeyAsString.includes('BEGIN PRIVATE KEY')
    ? privateKeyAsString.replace(/\\n/g, '\n')
    : `-----BEGIN PRIVATE KEY-----\n${privateKeyAsString}\n-----END PRIVATE KEY-----`;

  const privateKey = crypto.createPrivateKey({
    key: privateKeyAsPem,
    format: 'pem'
  });

  return crypto.sign('sha256', Buffer.from(serialized), privateKey).toString('base64');
}
