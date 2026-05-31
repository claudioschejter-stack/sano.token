'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTranslation } from '../../i18n/LocaleProvider';
import { isWalletConnectConfigured } from '../../lib/web3/config';

export function WalletConnectButton() {
  const t = useTranslation();
  const connectLabel = isWalletConnectConfigured ? t.wallet.connectWallet : t.wallet.connectCoinbase;

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              disabled={!ready}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-3 text-sm font-semibold text-terminal-primary hover:bg-terminal-primary/20 disabled:opacity-50"
            >
              {connectLabel}
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="w-full rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 text-sm font-semibold text-terminal-warning"
            >
              Red incorrecta
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm font-semibold text-terminal-text hover:border-terminal-primary/50"
          >
            {account.displayName} · {t.wallet.disconnect}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
