'use client';

import { Wallet } from 'lucide-react';
import { useInjectedWallet } from '../../hooks/useInjectedWallet';
import { useTranslation } from '../../i18n/LocaleProvider';

export function WalletConnectButton() {
  const t = useTranslation();
  const { address, isConnected, isPending, connect, disconnect } = useInjectedWallet();

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={disconnect}
        className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm font-semibold text-terminal-text hover:border-terminal-primary/50"
      >
        {address.slice(0, 6)}…{address.slice(-4)} · {t.wallet.disconnect}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => void connect()}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-3 text-sm font-semibold text-terminal-primary hover:bg-terminal-primary/20 disabled:opacity-50"
    >
      <Wallet size={18} />
      {isPending ? t.wallet.connecting : t.wallet.connect}
    </button>
  );
}
