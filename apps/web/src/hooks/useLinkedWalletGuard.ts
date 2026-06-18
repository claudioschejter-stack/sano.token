'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useAccountStatus } from './useAccountStatus';
import { usePrivyEmbeddedWallet } from './usePrivyEmbeddedWallet';
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
  isPrivyLinked: boolean;
};

export function useLinkedWalletGuard(): LinkedWalletGuard {
  const { address, isConnected, chainId } = useAccount();
  const { checklist } = useAccountStatus();
  const { address: privyAddress, authenticated: privyAuthenticated } = usePrivyEmbeddedWallet();

  const linkedWallet = checklist?.walletLinked ? checklist.walletAddress : null;
  const linkedWalletProvider = checklist?.walletProvider?.trim() || null;
  const isPrivyLinked = linkedWalletProvider?.toLowerCase().includes('privy') ?? false;

  return useMemo(() => {
    const wagmiConnected = address?.trim().toLowerCase() ?? null;
    const privyConnected = privyAddress?.trim().toLowerCase() ?? null;
    const connected = wagmiConnected ?? (isPrivyLinked && privyAuthenticated ? privyConnected : null);
    const linked = linkedWallet?.trim().toLowerCase() ?? null;
    const isWalletLinked = Boolean(linked);
    const effectiveConnected = Boolean(wagmiConnected || (isPrivyLinked && privyAuthenticated && privyConnected));
    const isWrongNetwork =
      effectiveConnected && !isPrivyLinked && chainId != null && chainId !== BASE_CHAIN_ID;
    const isWalletMismatch = Boolean(linked && connected && linked !== connected);

    return {
      linkedWallet: linked,
      linkedWalletProvider,
      connectedWallet: connected,
      isConnected: effectiveConnected,
      isWrongNetwork,
      isWalletLinked,
      isWalletMismatch,
      canSignOnChain: isWalletLinked && effectiveConnected && !isWrongNetwork && !isWalletMismatch,
      isPrivyLinked
    };
  }, [
    address,
    chainId,
    isConnected,
    isPrivyLinked,
    linkedWallet,
    linkedWalletProvider,
    privyAddress,
    privyAuthenticated
  ]);
}
