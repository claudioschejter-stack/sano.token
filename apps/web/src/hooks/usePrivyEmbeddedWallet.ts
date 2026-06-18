'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useMemo } from 'react';
import { createWalletClient, custom, type EIP1193Provider } from 'viem';
import { base } from 'viem/chains';
import { isPrivyEnabled } from '../lib/privy/config';

export function usePrivyEmbeddedWallet() {
  const enabled = isPrivyEnabled();
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = useMemo(
    () => wallets.find((wallet) => wallet.walletClientType === 'privy'),
    [wallets]
  );

  const address = embeddedWallet?.address as `0x${string}` | undefined;

  const getEthereumProvider = useCallback(async (): Promise<EIP1193Provider> => {
    const wallet = wallets.find((row) => row.walletClientType === 'privy');
    if (!wallet) {
      throw new Error('PRIVY_WALLET_NOT_READY');
    }
    try {
      await wallet.switchChain(base.id);
    } catch {
      /* already on Base */
    }
    const provider = await wallet.getEthereumProvider();
    if (!provider) {
      throw new Error('PRIVY_PROVIDER_UNAVAILABLE');
    }
    return provider as EIP1193Provider;
  }, [wallets]);

  const createEmbeddedWalletClient = useCallback(async () => {
    const provider = await getEthereumProvider();
    const wallet = wallets.find((row) => row.walletClientType === 'privy');
    if (!wallet?.address) {
      throw new Error('PRIVY_WALLET_NOT_READY');
    }
    return createWalletClient({
      account: wallet.address as `0x${string}`,
      chain: base,
      transport: custom(provider)
    });
  }, [getEthereumProvider, wallets]);

  const ensureReady = useCallback(async (): Promise<`0x${string}`> => {
    if (!enabled) {
      throw new Error('PRIVY_NOT_CONFIGURED');
    }
    if (!ready) {
      throw new Error('PRIVY_NOT_READY');
    }
    if (!authenticated) {
      await login();
    }
    const wallet = wallets.find((row) => row.walletClientType === 'privy');
    if (!wallet?.address) {
      throw new Error('PRIVY_WALLET_NOT_READY');
    }
    try {
      await wallet.switchChain(base.id);
    } catch {
      /* already on Base */
    }
    return wallet.address as `0x${string}`;
  }, [authenticated, enabled, login, ready, wallets]);

  return {
    enabled,
    ready,
    authenticated,
    user,
    address,
    embeddedWallet,
    login,
    logout,
    getAccessToken,
    ensureReady,
    getEthereumProvider,
    createEmbeddedWalletClient
  };
}
