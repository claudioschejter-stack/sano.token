'use client';

import { useCallback } from 'react';
import { usePrivyEmbeddedWallet } from './usePrivyEmbeddedWallet';

type PayToTreasuryInput = {
  amountUsd: number;
  stablecoinNetwork: string;
};

/** USDC treasury payment from Privy embedded wallet (User Pays gas on Base). */
export function usePrivyTreasuryPayment() {
  const { address, ensureReady, createEmbeddedWalletClient, enabled } = usePrivyEmbeddedWallet();

  const payToTreasury = useCallback(
    async (input: PayToTreasuryInput): Promise<`0x${string}`> => {
      if (!enabled) {
        throw new Error('PRIVY_NOT_CONFIGURED');
      }

      const payerAddress = address ?? (await ensureReady());

      const response = await fetch('/api/payments/usdc/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: input.amountUsd,
          stablecoinNetwork: input.stablecoinNetwork,
          payerAddress
        })
      });

      const data = (await response.json()) as {
        error?: string;
        prepared?: {
          chainId: number;
          transactions: Array<{ to: string; data: string; value: string }>;
        };
      };

      if (!response.ok || !data.prepared?.transactions.length) {
        throw new Error(data.error ?? 'USDC_PREPARE_FAILED');
      }

      const walletClient = await createEmbeddedWalletClient();
      let lastHash: `0x${string}` | null = null;

      for (const tx of data.prepared.transactions) {
        lastHash = await walletClient.sendTransaction({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value || '0')
        } as unknown as Parameters<typeof walletClient.sendTransaction>[0]);
      }

      if (!lastHash) {
        throw new Error('USDC_TX_FAILED');
      }

      return lastHash;
    },
    [address, createEmbeddedWalletClient, enabled, ensureReady]
  );

  return { payToTreasury, payerAddress: address, enabled };
}
