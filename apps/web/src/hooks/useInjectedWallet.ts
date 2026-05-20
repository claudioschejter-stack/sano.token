'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from '../i18n/LocaleProvider';

type EthereumProvider = {
  request: (args: { method: string }) => Promise<string[]>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function useInjectedWallet() {
  const t = useTranslation();
  const [address, setAddress] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.alert(t.wallet.noWallet);
      return;
    }

    setIsPending(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAddress(accounts[0] ?? null);
    } catch {
      setAddress(null);
    } finally {
      setIsPending(false);
    }
  }, [t.wallet.noWallet]);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  return {
    address,
    isConnected: Boolean(address),
    isPending,
    connect,
    disconnect
  };
}
