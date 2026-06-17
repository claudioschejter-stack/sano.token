'use client';

import { useCallback } from 'react';
import { useAccount, useConfig, useSwitchChain } from 'wagmi';
import { executePreparedTransactions } from '../lib/web3/executePreparedTransactions';

type PayToTreasuryInput = {
  amountUsd: number;
  stablecoinNetwork: string;
};

export function useUsdcTreasuryPayment() {
  const config = useConfig();
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const payToTreasury = useCallback(
    async (input: PayToTreasuryInput): Promise<`0x${string}`> => {
      if (!address) {
        throw new Error('WALLET_NOT_CONNECTED');
      }

      const response = await fetch('/api/payments/usdc/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: input.amountUsd,
          stablecoinNetwork: input.stablecoinNetwork,
          payerAddress: address
        })
      });

      const data = (await response.json()) as {
        error?: string;
        prepared?: {
          chainId: number;
          transactions: Array<{ to: string; data: string; value: string }>;
        };
      };

      if (!response.ok || !data.prepared) {
        throw new Error(data.error ?? 'USDC_PREPARE_FAILED');
      }

      const { chainId, transactions } = data.prepared;

      try {
        await switchChainAsync({ chainId });
      } catch {
        /* Some wallets already sit on the required chain. */
      }

      const result = await executePreparedTransactions(config, chainId, transactions);
      const txHash = result.hashes.at(-1);
      if (!txHash) {
        throw new Error('USDC_TX_FAILED');
      }

      return txHash;
    },
    [address, config, switchChainAsync]
  );

  return { payToTreasury, payerAddress: address };
}
