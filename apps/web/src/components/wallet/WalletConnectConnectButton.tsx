'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { useTranslation } from '../../i18n/LocaleProvider';
import { BASE_CHAIN_ID } from '../../lib/web3/config';
import { isWalletConnectConfigured } from '../../lib/web3/walletConnect';
import { pickWalletConnectConnector } from '../../lib/web3/walletConnectors';

function WalletConnectLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#3396FF" />
      <path
        d="M9.5 12.8c3.6-3.5 9.4-3.5 13 0l.4.4c.2.2.2.5 0 .7l-1.4 1.4c-.1.1-.3.1-.4 0l-.6-.6c-2.5-2.5-6.6-2.5-9.1 0l-.6.6c-.1.1-.3.1-.4 0l-1.4-1.4c-.2-.2-.2-.5 0-.7l.4-.4Zm16.1 3.7 1.2 1.2c.2.2.2.5 0 .7l-5.5 5.4c-.2.2-.5.2-.7 0l-3.9-3.9c-.1-.1-.2-.1-.3 0l-3.9 3.9c-.2.2-.5.2-.7 0l-5.5-5.4c-.2-.2-.2-.5 0-.7l1.2-1.2c.2-.2.5-.2.7 0l3.9 3.9c.1.1.2.1.3 0l3.9-3.9c.2-.2.5-.2.7 0l3.9 3.9c.1.1.2.1.3 0l3.9-3.9c.2-.2.5-.2.7 0Z"
        fill="white"
      />
    </svg>
  );
}

export type WalletConnectConnectButtonProps = {
  className?: string;
  disabled?: boolean;
  /** Compact icon trigger — opens WalletConnect QR / wallet picker. */
  iconOnly?: boolean;
};

export function WalletConnectConnectButton({
  className = '',
  disabled = false,
  iconOnly = false
}: WalletConnectConnectButtonProps) {
  const t = useTranslation();
  const c = t.cartCheckout;
  const w = t.wallet;
  const { address, isConnected, chainId, connector } = useAccount();
  const { connectors, connectAsync, isPending, error, reset } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const wcConnector = useMemo(() => pickWalletConnectConnector(connectors), [connectors]);
  const isWalletConnectSession =
    isConnected &&
    (connector?.id === 'walletConnect' ||
      connector?.type === 'walletConnect' ||
      connector?.name.toLowerCase().includes('walletconnect'));
  const wrongChain = isWalletConnectSession && chainId != null && chainId !== BASE_CHAIN_ID;
  const busy = isPending;

  /** Opens WalletConnect native modal (QR on desktop, wallet list on mobile). */
  const openWalletConnectModal = useCallback(async () => {
    if (!wcConnector || disabled || busy) {
      return;
    }

    reset();

    try {
      if (isConnected && !isWalletConnectSession) {
        await disconnectAsync();
      }
      await connectAsync({ connector: wcConnector, chainId: BASE_CHAIN_ID });
    } catch {
      /* wagmi surfaces error state */
    }
  }, [busy, connectAsync, disabled, disconnectAsync, isConnected, isWalletConnectSession, reset, wcConnector]);

  const switchToBase = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: BASE_CHAIN_ID });
    } catch {
      /* user may reject */
    }
  }, [switchChainAsync]);

  const disconnectPaymentWallet = useCallback(async () => {
    try {
      await disconnectAsync();
    } catch {
      /* user may cancel */
    }
  }, [disconnectAsync]);

  if (!isWalletConnectConfigured) {
    return (
      <p className={`text-xs text-terminal-warning ${className}`}>{w.walletConnectUnavailable}</p>
    );
  }

  if (iconOnly) {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={() => void openWalletConnectModal()}
          disabled={disabled || busy || !wcConnector}
          title={c.walletConnectIconTitle}
          aria-label={c.walletConnectIconTitle}
          className="inline-flex items-center justify-center rounded-xl border-2 border-[#3396FF]/30 bg-[#3396FF]/10 p-3 transition hover:border-[#3396FF] hover:bg-[#3396FF]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-10 w-10 animate-spin text-[#3396FF]" aria-hidden />
          ) : (
            <WalletConnectLogo className="h-10 w-10" />
          )}
        </button>
        <p className="max-w-xs text-center text-[11px] text-slate-600">{c.walletConnectOpenHint}</p>
        {isWalletConnectSession && address ? (
          <p className="font-mono text-[11px] font-medium text-emerald-700">
            {address.slice(0, 6)}…{address.slice(-4)} · {c.walletConnectReady}
          </p>
        ) : null}
        {error ? <p className="text-xs text-terminal-warning">{w.connectFailed}</p> : null}
      </div>
    );
  }

  if (wrongChain) {
    return (
      <button
        type="button"
        onClick={() => void switchToBase()}
        className={`w-full rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 text-sm font-semibold text-terminal-warning ${className}`}
      >
        {w.wrongNetwork}
      </button>
    );
  }

  if (isWalletConnectSession && address) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-4 py-3 text-sm">
          <p className="text-xs text-terminal-muted">{c.walletConnectConnectedLabel}</p>
          <p className="mt-1 break-all font-mono text-xs text-terminal-text">
            {address.slice(0, 6)}…{address.slice(-4)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void disconnectPaymentWallet()}
          className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-text"
        >
          {w.disconnect}
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void openWalletConnectModal()}
        disabled={disabled || busy || !wcConnector}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#3396FF]/40 bg-[#3396FF]/10 px-4 py-3 text-sm font-semibold text-[#3396FF] hover:bg-[#3396FF]/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <WalletConnectLogo className="h-5 w-5" />}
        {busy ? w.connecting : c.walletConnectModalConnect}
      </button>
      <p className="mt-2 text-center text-xs text-terminal-muted">{c.walletConnectOpenHint}</p>
      {error ? <p className="mt-2 text-xs text-terminal-warning">{w.connectFailed}</p> : null}
    </div>
  );
}

export { WalletConnectLogo };
