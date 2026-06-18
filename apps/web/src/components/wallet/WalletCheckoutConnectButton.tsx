'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { useTranslation } from '../../i18n/LocaleProvider';
import { formatMessage } from '../../i18n';
import { isMobileDevice } from '../../lib/mobile/deviceConfig';
import { connectCheckoutWallet, resolveCheckoutWalletConnector } from '../../lib/web3/connectCheckoutWallet';
import { BASE_CHAIN_ID } from '../../lib/web3/config';
import type { CheckoutWalletOptionId } from '../../lib/web3/walletConnectors';

export type WalletCheckoutConnectButtonProps = {
  optionId: CheckoutWalletOptionId;
  walletLabel: string;
  className?: string;
  disabled?: boolean;
};

function humanizeConnectError(
  error: unknown,
  messages: { connectFailed: string; connectRejected: string }
): string {
  const name = error instanceof Error ? error.name : '';
  const text = error instanceof Error ? error.message : String(error);
  const lower = text.toLowerCase();

  if (
    name === 'UserRejectedRequestError' ||
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request')
  ) {
    return messages.connectRejected;
  }

  return messages.connectFailed;
}

export function WalletCheckoutConnectButton({
  optionId,
  walletLabel,
  className = '',
  disabled = false
}: WalletCheckoutConnectButtonProps) {
  const t = useTranslation();
  const c = t.cartCheckout;
  const w = t.wallet;
  const { address, isConnected, chainId, connector } = useAccount();
  const { connectors, connectAsync, isPending, error, reset } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const targetConnector = useMemo(
    () => resolveCheckoutWalletConnector(optionId, connectors),
    [connectors, optionId]
  );
  const isTargetSession = isConnected && Boolean(address);
  const wrongChain = isTargetSession && chainId != null && chainId !== BASE_CHAIN_ID;
  const busy = isPending;

  const openConnect = useCallback(async () => {
    if (disabled || busy || !targetConnector) {
      return;
    }

    try {
      await connectCheckoutWallet({
        optionId,
        connectors,
        connectAsync,
        disconnectAsync,
        isConnected,
        activeConnectorId: connector?.id,
        resetConnect: reset,
        switchChainAsync
      });
    } catch {
      /* wagmi surfaces error state */
    }
  }, [
    busy,
    connectAsync,
    connector?.id,
    connectors,
    disabled,
    disconnectAsync,
    isConnected,
    optionId,
    reset,
    switchChainAsync,
    targetConnector
  ]);

  const switchToBase = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: BASE_CHAIN_ID });
    } catch {
      /* user may reject */
    }
  }, [switchChainAsync]);

  const hint = isMobileDevice()
    ? formatMessage(c.walletMobileConnectHint, { wallet: walletLabel })
    : formatMessage(c.walletDesktopConnectHint, { wallet: walletLabel });

  if (!targetConnector) {
    return (
      <p className={`text-xs text-terminal-warning ${className}`}>{c.paymentUnavailable}</p>
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

  if (isTargetSession && address) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="font-mono text-[11px] font-medium text-emerald-700">
          {formatMessage(c.walletConnectPayingFromShort, {
            address: `${address.slice(0, 6)}…${address.slice(-4)}`
          })}
        </p>
        <button
          type="button"
          onClick={() => void disconnectAsync()}
          className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-text"
        >
          {w.disconnect}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void openConnect()}
        disabled={disabled || busy}
        className="flex w-full min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-600/40 bg-blue-600/10 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
        {busy
          ? w.connecting
          : formatMessage(c.walletCheckoutConnectButton, { wallet: walletLabel })}
      </button>
      <p className="max-w-xs text-center text-[11px] text-slate-600">{hint}</p>
      {error ? (
        <p className="text-xs text-terminal-warning">
          {humanizeConnectError(error, {
            connectFailed: w.connectFailed,
            connectRejected: w.connectRejected
          })}
        </p>
      ) : null}
    </div>
  );
}
