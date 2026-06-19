import { getAddress } from 'ethers';
import { privyApiBase, privyHeaders } from './privyHttp';

export type PrivySendTransactionInput = {
  walletId: string;
  chainId: number;
  to: string;
  data?: string;
  value?: bigint;
  idempotencyKey?: string;
};

function toHexQuantity(value: bigint): string {
  return `0x${value.toString(16)}`;
}

/** Broadcast an EVM transaction from a Privy server wallet. */
export async function privySendTransaction(input: PrivySendTransactionInput): Promise<string> {
  const walletId = input.walletId.trim();
  if (!walletId) {
    throw new Error('PRIVY_WALLET_ID_NOT_CONFIGURED');
  }

  const body = {
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

  const response = await fetch(`${privyApiBase()}/api/v1/wallets/${walletId}/rpc`, {
    method: 'POST',
    headers: privyHeaders(
      input.idempotencyKey ? { 'privy-idempotency-key': input.idempotencyKey } : undefined
    ),
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
