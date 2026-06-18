'use client';

import { useCallback } from 'react';
import { executePreparedTransactionsWithWalletClient } from '../lib/web3/executeWithWalletClient';
import type { VaultDepositLine } from '../lib/web3/vaultDepositPayment';
import { usePrivyEmbeddedWallet } from './usePrivyEmbeddedWallet';

type DepositToVaultsInput = {
  stablecoinNetwork: string;
  deposits: VaultDepositLine[];
};

/** USDC → ERC-4626 vault shares from Privy embedded wallet on Base. */
export function usePrivyVaultDeposit() {
  const { address, ensureReady, createEmbeddedWalletClient, enabled } = usePrivyEmbeddedWallet();

  const depositToVaults = useCallback(
    async (input: DepositToVaultsInput): Promise<`0x${string}`> => {
      if (!enabled) {
        throw new Error('PRIVY_NOT_CONFIGURED');
      }

      const payerAddress = address ?? (await ensureReady());

      const response = await fetch('/api/payments/vault-deposit/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stablecoinNetwork: input.stablecoinNetwork,
          payerAddress,
          deposits: input.deposits
        })
      });

      const data = (await response.json()) as {
        error?: string;
        prepared?: {
          transactions: Array<{ to: string; data: string; value: string }>;
        };
      };

      if (!response.ok || !data.prepared?.transactions.length) {
        throw new Error(data.error ?? 'VAULT_DEPOSIT_PREPARE_FAILED');
      }

      const walletClient = await createEmbeddedWalletClient();
      const { hashes } = await executePreparedTransactionsWithWalletClient(
        walletClient,
        data.prepared.transactions
      );

      const lastHash = hashes.at(-1);
      if (!lastHash) {
        throw new Error('VAULT_DEPOSIT_TX_FAILED');
      }

      return lastHash;
    },
    [address, createEmbeddedWalletClient, enabled, ensureReady]
  );

  return { depositToVaults, payerAddress: address, enabled };
}
