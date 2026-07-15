'use client';

import { useCallback } from 'react';
import { useAccount, useConfig, useSwitchChain } from 'wagmi';
import { executePreparedTransactions } from '../lib/web3/executePreparedTransactions';

type DepositLine = {
  vaultAddress: string;
  amountUsd: number;
};

type DepositToVaultExternalInput = {
  stablecoinNetwork: string;
  deposits: DepositLine[];
};

type PrepareVaultDepositResponse = {
  error?: string;
  prepared?: {
    chainId: number;
    transactions: Array<{ to: string; data: string; value: string }>;
  };
};

/**
 * Deposits USDC into an ERC-4626 vault (e.g. Steakhouse/Gauntlet on Base)
 * directly from the user's own connected wallet (WalletConnect/Coinbase),
 * signing approve + deposit in-browser via wagmi. Mirrors useUsdcTreasuryPayment,
 * but targets /api/payments/vault-deposit/prepare with receiver = the
 * connected wallet itself, so the vault shares land in the user's own wallet.
 */
export function useExternalWalletVaultDeposit() {
  const config = useConfig();
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const depositToVaultExternal = useCallback(
    async (input: DepositToVaultExternalInput): Promise<`0x${string}`> => {
      if (!address) {
        throw new Error('WALLET_NOT_CONNECTED');
      }

      const response = await fetch('/api/payments/vault-deposit/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stablecoinNetwork: input.stablecoinNetwork,
          payerAddress: address,
          deposits: input.deposits
        })
      });

      const data = (await response.json()) as PrepareVaultDepositResponse;

      if (!response.ok || !data.prepared) {
        throw new Error(data.error ?? 'VAULT_DEPOSIT_PREPARE_FAILED');
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
        throw new Error('VAULT_DEPOSIT_TX_FAILED');
      }

      return txHash;
    },
    [address, config, switchChainAsync]
  );

  return { depositToVaultExternal, payerAddress: address };
}
