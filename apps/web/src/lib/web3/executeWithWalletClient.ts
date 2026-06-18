import type { PreparedOnChainTx } from './executePreparedTransactions';
import type { WalletClient } from 'viem';

export async function executePreparedTransactionsWithWalletClient(
  walletClient: WalletClient,
  transactions: PreparedOnChainTx[]
): Promise<{ hashes: `0x${string}`[] }> {
  const hashes: `0x${string}`[] = [];

  for (const tx of transactions) {
    const hash = await walletClient.sendTransaction({
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value || '0')
    } as unknown as Parameters<typeof walletClient.sendTransaction>[0]);
    hashes.push(hash);
  }

  return { hashes };
}
