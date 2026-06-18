'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from '../i18n/LocaleProvider';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthereumProvider | undefined {
  const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return ethereum;
}

export function useInjectedWallet() {
  const t = useTranslation();
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);

  const connect = useCallback(async () => {
    if (!getEthereum()) {
      window.alert(t.wallet.noWallet);
      return;
    }

    setIsPending(true);
    try {
      const ethereum = getEthereum()!;
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const rawChainId = (await ethereum.request({ method: 'eth_chainId' })) as string;
      setAddress(accounts[0] ?? null);
      setChainId(Number.parseInt(rawChainId, 16));
    } catch {
      setAddress(null);
      setChainId(null);
    } finally {
      setIsPending(false);
    }
  }, [t.wallet.noWallet]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  const switchChain = useCallback(async (targetChainId: number) => {
    if (!getEthereum()) {
      window.alert(t.wallet.noWallet);
      return false;
    }

    await getEthereum()!.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${targetChainId.toString(16)}` }]
    });
    setChainId(targetChainId);
    return true;
  }, [t.wallet.noWallet]);

  const sendErc20Transfer = useCallback(async (input: {
    tokenAddress: string;
    to: string;
    amountBaseUnits: string;
  }) => {
    const ethereum = getEthereum();
    if (!ethereum || !address) {
      throw new Error('WALLET_NOT_CONNECTED');
    }

    const transferSelector = '0xa9059cbb';
    const encodedTo = input.to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const encodedAmount = BigInt(input.amountBaseUnits).toString(16).padStart(64, '0');

    return ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: address,
          to: input.tokenAddress,
          data: `${transferSelector}${encodedTo}${encodedAmount}`
        }
      ]
    }) as Promise<string>;
  }, [address]);

  return {
    address,
    chainId,
    isConnected: Boolean(address),
    isPending,
    connect,
    disconnect,
    switchChain,
    sendErc20Transfer
  };
}
