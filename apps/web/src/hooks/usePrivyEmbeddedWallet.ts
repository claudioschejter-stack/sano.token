'use client';

import { useCreateWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createWalletClient, custom, type EIP1193Provider } from 'viem';
import { base } from 'viem/chains';
import { isPrivyEnabled } from '../lib/privy/config';

const WALLET_POLL_INTERVAL_MS = 400;
const WALLET_POLL_TIMEOUT_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findPrivyWallet<T extends { walletClientType: string }>(wallets: T[]): T | undefined {
  return wallets.find((row) => row.walletClientType === 'privy');
}

export function usePrivyEmbeddedWallet() {
  const enabled = isPrivyEnabled();
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();

  // Privy creates the embedded wallet asynchronously right after login
  // (createOnLogin: 'users-without-wallets'), so `wallets` is frequently
  // stale for a moment. Keep a ref so ensureReady() can poll fresh values
  // instead of the closure captured at call time.
  const walletsRef = useRef(wallets);
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  const embeddedWallet = useMemo(() => findPrivyWallet(wallets), [wallets]);

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

    // Automatic embedded wallet creation happens asynchronously right after
    // login, so poll briefly for it instead of failing on the first check.
    const deadline = Date.now() + WALLET_POLL_TIMEOUT_MS;
    let wallet = findPrivyWallet(walletsRef.current);
    while (!wallet?.address && Date.now() < deadline) {
      await sleep(WALLET_POLL_INTERVAL_MS);
      wallet = findPrivyWallet(walletsRef.current);
    }

    if (!wallet?.address) {
      // Automatic creation didn't land in time (or is disabled for this
      // login method) — trigger it explicitly as a documented fallback.
      try {
        const created = (await createWallet()) as
          | { address?: string; wallet?: { address?: string } }
          | undefined;
        const fallbackAddress =
          created?.address ??
          created?.wallet?.address ??
          findPrivyWallet(walletsRef.current)?.address;
        if (!fallbackAddress) {
          throw new Error('PRIVY_WALLET_NOT_READY');
        }
        return fallbackAddress as `0x${string}`;
      } catch (err) {
        console.error('[usePrivyEmbeddedWallet] createWallet fallback failed', err);
        throw new Error('PRIVY_WALLET_NOT_READY');
      }
    }

    try {
      await wallet.switchChain(base.id);
    } catch {
      /* already on Base */
    }
    return wallet.address as `0x${string}`;
  }, [authenticated, createWallet, enabled, login, ready]);

  return {
    enabled,
    ready,
    walletsReady,
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
