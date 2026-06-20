'use client';

import { Check, Copy, Loader2, Wallet } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from 'wagmi';
import { useTranslation } from '../../i18n/LocaleProvider';
import { BASE_CHAIN_ID } from '../../lib/web3/config';

function pickCoinbaseConnector(connectors: readonly Connector[]) {
  return connectors.find(
    (connector) =>
      connector.id === 'coinbaseWalletSDK' ||
      connector.type === 'coinbaseWallet' ||
      connector.name.toLowerCase().includes('coinbase')
  );
}

export type CoinbaseConnectButtonProps = {
  className?: string;
  disabled?: boolean;
  /** Show connected address + disconnect instead of connect. */
  showAccount?: boolean;
};

export function CoinbaseConnectButton({
  className = '',
  disabled = false,
  showAccount = true
}: CoinbaseConnectButtonProps) {
  const t = useTranslation();
  const w = t.wallet;
  const pw = t.adminSettings.platformWallet;
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync, isPending, error, reset } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [copied, setCopied] = useState(false);

  const coinbaseConnector = useMemo(() => pickCoinbaseConnector(connectors), [connectors]);
  const wrongChain = isConnected && chainId != null && chainId !== BASE_CHAIN_ID;
  const busy = isPending;
  const connectLabel = showAccount ? w.connectSimple : w.connectCoinbase;

  const connect = useCallback(async () => {
    if (!coinbaseConnector) return;
    reset();
    try {
      await connectAsync({ connector: coinbaseConnector, chainId: BASE_CHAIN_ID });
    } catch {
      /* caller may surface error via wagmi state */
    }
  }, [coinbaseConnector, connectAsync, reset]);

  const switchToBase = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: BASE_CHAIN_ID });
    } catch {
      /* user may cancel */
    }
  }, [switchChainAsync]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
    } catch {
      /* user may cancel */
    }
  }, [disconnectAsync]);

  const copyAddress = useCallback(async () => {
    if (!address) {
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [address]);

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={() => void connect()}
        disabled={disabled || busy || !coinbaseConnector}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-3 text-sm font-semibold text-terminal-primary hover:bg-terminal-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Wallet size={16} aria-hidden />}
        {busy ? w.connecting : connectLabel}
      </button>
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

  if (!showAccount) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm">
        <p className="text-xs text-terminal-muted">Coinbase Wallet · Base</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 break-all font-mono text-xs text-terminal-text">{address}</p>
          <button
            type="button"
            onClick={() => void copyAddress()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-terminal-border px-2 py-1 text-xs text-terminal-muted transition-colors hover:border-terminal-primary/40 hover:text-terminal-text"
            aria-label={pw.copy}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? pw.copied : pw.copy}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void disconnect()}
        className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-text hover:border-terminal-primary/50"
      >
        {w.disconnect}
      </button>
      {error ? <p className="text-xs text-terminal-warning">{w.connectFailed}</p> : null}
    </div>
  );
}
