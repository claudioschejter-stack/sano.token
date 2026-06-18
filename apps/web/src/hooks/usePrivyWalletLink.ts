'use client';

import { useCallback, useState } from 'react';
import { useAccountStatus } from './useAccountStatus';
import { usePrivyEmbeddedWallet } from './usePrivyEmbeddedWallet';

export function usePrivyWalletLink() {
  const { refresh } = useAccountStatus();
  const { ensureReady, enabled } = usePrivyEmbeddedWallet();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkPrivyWallet = useCallback(async (): Promise<`0x${string}` | null> => {
    if (!enabled) {
      setError('PRIVY_NOT_CONFIGURED');
      return null;
    }

    setLinking(true);
    setError(null);

    try {
      const address = await ensureReady();
      const response = await fetch('/api/investor/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          walletProvider: 'Privy Wallet'
        })
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'WALLET_LINK_FAILED');
      }

      await refresh({ silent: true });
      return address;
    } catch (linkError) {
      const message = linkError instanceof Error ? linkError.message : 'WALLET_LINK_FAILED';
      setError(message);
      return null;
    } finally {
      setLinking(false);
    }
  }, [enabled, ensureReady, refresh]);

  return { linkPrivyWallet, linking, error, enabled };
}
