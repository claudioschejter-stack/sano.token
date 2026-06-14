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
): Promise<'batch' | 'sequential'> {
  if (transactions.length === 0) {
    return 'sequential';
  }

  const calls = transactions.map((tx) => ({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value || '0')
  }));

  if (transactions.length > 1) {
    try {
      const { id } = await sendCalls(config, { chainId, calls });
      await waitForCallsStatus(config, { id });
      return 'batch';
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
  }

  return 'sequential';
}
