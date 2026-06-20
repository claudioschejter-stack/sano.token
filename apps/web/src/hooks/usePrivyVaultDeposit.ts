'use client';

import { useCallback } from 'react';
import { executePreparedTransactionsWithWalletClient } from '../lib/web3/executeWithWalletClient';
import type { VaultDepositLine } from '../lib/web3/vaultDepositPayment';
import { usePrivyEmbeddedWallet } from './usePrivyEmbeddedWallet';

type DepositToVaultsInput = {
  stablecoinNetwork: string;
  deposits: VaultDepositLine[];
};

async function depositViaPrivyEarnApi(input: {
  privyAccessToken: string;
  walletAddress: string;
  stablecoinNetwork: string;
  deposits: VaultDepositLine[];
}): Promise<`0x${string}`> {
  const response = await fetch('/api/privy/earn/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      privyAccessToken: input.privyAccessToken,
      walletAddress: input.walletAddress,
      deposits: input.deposits,
      idempotencyPrefix: `vault:${input.stablecoinNetwork}:${Date.now()}`
    })
  });

  const data = (await response.json()) as {
    error?: string;
    result?: { transactionHash?: string | null };
  };

  if (!response.ok || !data.result?.transactionHash) {
    throw new Error(data.error ?? 'PRIVY_EARN_DEPOSIT_FAILED');
  }

  return data.result.transactionHash as `0x${string}`;
}

/** USDC → ERC-4626 vault shares from Privy embedded wallet on Base (Earn API or direct deposit). */
export function usePrivyVaultDeposit() {
  const { address, ensureReady, createEmbeddedWalletClient, enabled, getAccessToken } =
    usePrivyEmbeddedWallet();

  const depositToVaults = useCallback(
    async (input: DepositToVaultsInput): Promise<`0x${string}`> => {
      if (!enabled) {
        throw new Error('PRIVY_NOT_CONFIGURED');
      }

      const payerAddress = address ?? (await ensureReady());
      const privyAccessToken = await getAccessToken();

      if (privyAccessToken) {
        try {
          return await depositViaPrivyEarnApi({
            privyAccessToken,
            walletAddress: payerAddress,
            stablecoinNetwork: input.stablecoinNetwork,
            deposits: input.deposits
          });
        } catch (earnError) {
          const message = earnError instanceof Error ? earnError.message : '';
          if (
            message !== 'PRIVY_EARN_NOT_CONFIGURED' &&
            message !== 'PRIVY_EARN_DEPOSIT_NOT_ELIGIBLE' &&
            message !== 'PRIVY_EARN_VAULT_NOT_MAPPED'
          ) {
            throw earnError;
          }
        }
      }

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
    [address, createEmbeddedWalletClient, enabled, ensureReady, getAccessToken]
  );

  return { depositToVaults, payerAddress: address, enabled };
}
