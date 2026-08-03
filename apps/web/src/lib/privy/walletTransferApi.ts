import { getAddress } from 'ethers';
import { privyAppId } from './config';
import {
  buildPrivyAuthorizationSignature,
  isPrivyAuthorizationSigningConfigured
} from './privyAuthorizationSignature';
import { privyApiBase, privyHeaders } from './privyHttp';

export type PrivyTransferUsdcInput = {
  walletId: string;
  /** Decimal USDC amount, e.g. 20 or 20.5 */
  amountUsdc: number;
  destinationAddress: string;
  chain?: 'base';
  idempotencyKey?: string;
  requireAuthorizationSignature?: boolean;
};

export type PrivyTransferUsdcResult = {
  actionId: string;
  status: string;
  /** On-chain hash when available (evm_transaction or user-op bundle). */
  txHash: string | null;
};

/** Privy expects a decimal string like "20.0" / "20.5" (not base units). */
export function formatPrivyUsdcAmount(amountUsdc: number): string {
  if (!(amountUsdc > 0) || !Number.isFinite(amountUsdc)) {
    throw new Error('PRIVY_TRANSFER_AMOUNT_INVALID');
  }
  const rounded = Math.round(amountUsdc * 1e6) / 1e6;
  const trimmed = rounded.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return trimmed.includes('.') ? trimmed : `${trimmed}.0`;
}

function extractTxHash(payload: Record<string, unknown>): string | null {
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    const row = step as Record<string, unknown>;
    const hash =
      (typeof row.transaction_hash === 'string' && row.transaction_hash) ||
      (typeof row.bundle_transaction_hash === 'string' && row.bundle_transaction_hash) ||
      null;
    if (hash?.startsWith('0x')) return hash;
  }

  const nested = payload.data;
  if (nested && typeof nested === 'object') {
    const data = nested as Record<string, unknown>;
    const hash =
      (typeof data.hash === 'string' && data.hash) ||
      (typeof data.transaction_hash === 'string' && data.transaction_hash) ||
      null;
    if (hash?.startsWith('0x')) return hash;
  }

  if (typeof payload.transaction_hash === 'string' && payload.transaction_hash.startsWith('0x')) {
    return payload.transaction_hash;
  }

  return null;
}

/**
 * Same-chain USDC transfer via Privy Transfer API.
 * Required for Dashboard → Gas sponsorship → **User pays** (USDC on Base).
 * Do NOT use eth_sendTransaction + sponsor_options — Privy rejects that with invalid_data.
 *
 * @see https://docs.privy.io/wallets/gas-and-asset-management/gas/setup
 */
export async function privyTransferUsdc(input: PrivyTransferUsdcInput): Promise<PrivyTransferUsdcResult> {
  const walletId = input.walletId.trim();
  if (!walletId) {
    throw new Error('PRIVY_WALLET_ID_NOT_CONFIGURED');
  }

  const amount = formatPrivyUsdcAmount(input.amountUsdc);
  const url = `${privyApiBase()}/v1/wallets/${walletId}/transfer?include=steps`;
  // Privy Node/SDK shape (top-level amount). User-pays gas applies automatically
  // when Dashboard is configured for Base/USDC — no sponsor_options here.
  const body: Record<string, unknown> = {
    amount,
    amount_type: 'exact_input',
    source: {
      asset: 'usdc',
      chain: input.chain ?? 'base'
    },
    destination: {
      address: getAddress(input.destinationAddress)
    }
  };

  const needsAuth =
    input.requireAuthorizationSignature !== false && isPrivyAuthorizationSigningConfigured();

  const extraHeaders: Record<string, string> = {};
  if (input.idempotencyKey?.trim()) {
    extraHeaders['privy-idempotency-key'] = input.idempotencyKey.trim();
  }
  if (needsAuth) {
    extraHeaders['privy-authorization-signature'] = buildPrivyAuthorizationSignature({
      // Signature URL must not include query string.
      url: url.split('?')[0],
      body,
      idempotencyKey: input.idempotencyKey
    });
  }

  void privyAppId();

  const response = await fetch(url, {
    method: 'POST',
    headers: privyHeaders(extraHeaders),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PRIVY_TRANSFER_FAILED:${response.status}:${text}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const status = typeof payload.status === 'string' ? payload.status : 'unknown';
  const actionId = typeof payload.id === 'string' ? payload.id : '';
  const txHash = extractTxHash(payload);

  if (status === 'failed' || status === 'rejected') {
    throw new Error(`PRIVY_TRANSFER_FAILED:${status}:${JSON.stringify(payload.failure_reason ?? payload)}`);
  }

  return { actionId, status, txHash };
}

/** Poll transfer action until a transaction hash is present or terminal failure. */
export async function privyWaitForTransferTxHash(input: {
  walletId: string;
  actionId: string;
  attempts?: number;
}): Promise<string> {
  const attempts = input.attempts ?? 8;
  const walletId = input.walletId.trim();
  const actionId = input.actionId.trim();
  if (!walletId || !actionId) {
    throw new Error('PRIVY_TRANSFER_ACTION_REQUIRED');
  }

  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, i === 1 ? 1500 : 2500));
    }
    const url = `${privyApiBase()}/v1/wallets/${walletId}/actions/${actionId}?include=steps`;
    const response = await fetch(url, {
      method: 'GET',
      headers: privyHeaders()
    });
    if (!response.ok) continue;
    const payload = (await response.json()) as Record<string, unknown>;
    const status = typeof payload.status === 'string' ? payload.status : '';
    if (status === 'failed' || status === 'rejected') {
      throw new Error(`PRIVY_TRANSFER_FAILED:${status}:${JSON.stringify(payload.failure_reason ?? payload)}`);
    }
    const hash = extractTxHash(payload);
    if (hash) return hash;
  }

  throw new Error('PRIVY_TRANSFER_TX_HASH_PENDING');
}
