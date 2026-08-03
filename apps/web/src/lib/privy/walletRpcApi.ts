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
  to: string;
  data?: string;
  value?: bigint;
  idempotencyKey?: string;
  /**
   * Privy gas sponsorship flag.
   * - App pays (gas credits): `sponsor: true` without `sponsorAsset`
   * - User pays (USDC/USDT): `sponsor: true` + `sponsorAsset: 'usdc'`
   */
  sponsor?: boolean;
  /**
   * User-pays gas token for RPC (`sponsor_options.asset`).
   * Requires Dashboard → Gas sponsorship → User pays + chain/asset enabled.
   */
  sponsorAsset?: 'usdc' | 'usdt' | 'eurc' | 'usdg' | 'usdc_e';
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
  const body: Record<string, unknown> = {
    method: 'eth_sendTransaction',
    caip2: `eip155:${input.chainId}`,
    params: {
      transaction: {
        to: getAddress(input.to),
        data: input.data?.trim() || '0x',
        value: toHexQuantity(input.value ?? 0n),
        chain_id: input.chainId
      }
    }
  };

  if (input.sponsor) {
    body.sponsor = true;
    if (input.sponsorAsset) {
      body.sponsor_options = { asset: input.sponsorAsset };
    }
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
