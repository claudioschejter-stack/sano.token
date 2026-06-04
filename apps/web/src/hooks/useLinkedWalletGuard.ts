'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useAccountStatus } from './useAccountStatus';
import { BASE_CHAIN_ID } from '../lib/web3/config';

export type LinkedWalletGuard = {
  linkedWallet: string | null;
  linkedWalletProvider: string | null;
  connectedWallet: string | null;
  isConnected: boolean;
  isWrongNetwork: boolean;
  isWalletLinked: boolean;
  isWalletMismatch: boolean;
  canSignOnChain: boolean;
};

export function useLinkedWalletGuard(): LinkedWalletGuard {
  const { address, isConnected, chainId } = useAccount();
  const { checklist } = useAccountStatus();

  const linkedWallet = checklist?.walletLinked ? checklist.walletAddress : null;
  const linkedWalletProvider = checklist?.walletProvider?.trim() || null;

  return useMemo(() => {
    const connected = address?.trim().toLowerCase() ?? null;
    const linked = linkedWallet?.trim().toLowerCase() ?? null;
    const isWalletLinked = Boolean(linked);
    const isWrongNetwork = isConnected && chainId != null && chainId !== BASE_CHAIN_ID;
    const isWalletMismatch = Boolean(linked && connected && linked !== connected);

    return {
      linkedWallet: linked,
      linkedWalletProvider,
      connectedWallet: connected,
      isConnected,
      isWrongNetwork,
      isWalletLinked,
      isWalletMismatch,
      canSignOnChain: isWalletLinked && isConnected && !isWrongNetwork && !isWalletMismatch
    };
  }, [address, chainId, isConnected, linkedWallet, linkedWalletProvider]);
}
