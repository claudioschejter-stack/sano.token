import { getAddress } from 'ethers';
import { privyAppId } from './config';
import {
  buildPrivyAuthorizationSignature,
  isPrivyAuthorizationSigningConfigured
} from './privyAuthorizationSignature';
import { privyApiBase, privyHeaders } from './privyHttp';

export type PrivySendTransactionInput = {
  walletId: string;
  chainId: number;
  /** Omit for contract creation, which has no recipient. */
  to?: string | null;
  data?: string;
  value?: bigint;
  idempotencyKey?: string;
  /**
   * App-pays gas sponsorship (`sponsor: true` uses gas credits).
   * User pays (USDC on Base) is NOT supported on eth_sendTransaction —
   * use Transfer API (`privyTransferUsdc`) instead. Sending sponsor_options
   * here returns 400 invalid_data from Privy.
   */
  sponsor?: boolean;
  /** Attach app authorization signature (needed for user-owned embedded wallets). */
  requireAuthorizationSignature?: boolean;
};

function toHexQuantity(value: bigint): string {
  return `0x${value.toString(16)}`;
}

/** Broadcast an EVM transaction from a Privy wallet (server or delegated user wallet). */
export async function privySendTransaction(input: PrivySendTransactionInput): Promise<string> {
  const walletId = input.walletId.trim();
  if (!walletId) {
    throw new Error('PRIVY_WALLET_ID_NOT_CONFIGURED');
  }

  // Existing server-wallet callers use `/api/v1/...` on api.privy.io.
  const url = `${privyApiBase()}/api/v1/wallets/${walletId}/rpc`;
  const transaction: Record<string, unknown> = {
    data: input.data?.trim() || '0x',
    value: toHexQuantity(input.value ?? 0n),
    chain_id: input.chainId
  };
  // Contract creation carries no `to`, and sending an empty one is rejected.
  if (input.to) {
    transaction.to = getAddress(input.to);
  }

  const body: Record<string, unknown> = {
    method: 'eth_sendTransaction',
    caip2: `eip155:${input.chainId}`,
    params: { transaction }
  };

  if (input.sponsor) {
    body.sponsor = true;
  }

  const needsAuth =
    input.requireAuthorizationSignature !== false && isPrivyAuthorizationSigningConfigured();

  const extraHeaders: Record<string, string> = {};
  if (input.idempotencyKey?.trim()) {
    extraHeaders['privy-idempotency-key'] = input.idempotencyKey.trim();
  }
  if (needsAuth) {
    extraHeaders['privy-authorization-signature'] = buildPrivyAuthorizationSignature({
      url,
      body,
      idempotencyKey: input.idempotencyKey
    });
  }

  // Ensure app id is present for signature verification even if headers merge changes.
  void privyAppId();

  const response = await fetch(url, {
    method: 'POST',
    headers: privyHeaders(extraHeaders),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PRIVY_SEND_TRANSACTION_FAILED:${response.status}:${text}`);
  }

  const payload = (await response.json()) as {
    data?: { hash?: string; transaction_hash?: string };
    hash?: string;
    transaction_hash?: string;
  };

  const hash =
    payload.data?.hash ??
    payload.data?.transaction_hash ??
    payload.hash ??
    payload.transaction_hash;

  if (!hash?.trim()) {
    throw new Error('PRIVY_SEND_TRANSACTION_MISSING_HASH');
  }

  return hash.trim();
}
