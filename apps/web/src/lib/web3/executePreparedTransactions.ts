import {
  sendCalls,
  sendTransaction,
  waitForCallsStatus,
  waitForTransactionReceipt
} from '@wagmi/core';
import type { Config } from 'wagmi';

export type PreparedOnChainTx = {
  to: string;
  data: string;
  value: string;
};

/** Execute prepared txs via EIP-5792 batch (Coinbase Smart Wallet) or sequential fallback. */
export async function executePreparedTransactions(
  config: Config,
  chainId: number,
  transactions: PreparedOnChainTx[]
): Promise<{ mode: 'batch' | 'sequential'; hashes: `0x${string}`[] }> {
  if (transactions.length === 0) {
    return { mode: 'sequential', hashes: [] };
  }

  const calls = transactions.map((tx) => ({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value || '0')
  }));

  const hashes: `0x${string}`[] = [];

  if (transactions.length > 1) {
    try {
      const { id } = await sendCalls(config, { chainId, calls });
      const status = await waitForCallsStatus(config, { id });
      const receiptHashes = (status.receipts ?? [])
        .map((row) => row.transactionHash)
        .filter((hash): hash is `0x${string}` => Boolean(hash));
      if (receiptHashes.length > 0) {
        return { mode: 'batch', hashes: receiptHashes };
      }
    } catch {
      /* Wallet does not support wallet_sendCalls — sign each tx separately. */
    }
  }

  for (const tx of transactions) {
    const hash = await sendTransaction(config, {
      chainId,
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value || '0')
    });
    await waitForTransactionReceipt(config, { hash });
    hashes.push(hash);
  }

  return { mode: 'sequential', hashes };
}
