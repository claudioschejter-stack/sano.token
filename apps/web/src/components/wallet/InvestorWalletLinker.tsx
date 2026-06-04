'use client';

import { Loader2, Link2, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from 'wagmi';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import { formatMessage } from '../../i18n';
import { useTranslation } from '../../i18n/LocaleProvider';
import { BASE_CHAIN_ID, isWalletConnectConfigured } from '../../lib/web3/config';

export type InvestorWalletLinkerProps = {
  variant?: 'onboarding' | 'checkout' | 'dashboard';
  /** When true, lets the investor replace the linked wallet with the currently connected one. */
  allowReplace?: boolean;
  onLinked?: () => void | Promise<void>;
  onError?: (message: string | null) => void;
};

function humanizeConnectError(
  error: unknown,
  messages: { connectFailed: string; connectRejected: string; walletConnectNotConfigured: string }
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

  if (lower.includes('project id') || lower.includes('walletconnect') && lower.includes('not configured')) {
    return messages.walletConnectNotConfigured;
  }

  return messages.connectFailed;
}

function pickConnector(connectors: readonly Connector[], kind: 'coinbase' | 'walletConnect') {
  if (kind === 'coinbase') {
    return connectors.find(
      (connector) =>
        connector.id === 'coinbaseWalletSDK' ||
        connector.type === 'coinbaseWallet' ||
        connector.name.toLowerCase().includes('coinbase')
    );
  }

  return connectors.find(
    (connector) => connector.id === 'walletConnect' || connector.type === 'walletConnect'
  );
}

export function InvestorWalletLinker({
  variant = 'checkout',
  allowReplace = false,
  onLinked,
  onError
}: InvestorWalletLinkerProps) {
  const t = useTranslation();
  const o = t.onboarding.steps;
  const w = t.wallet;
  const c = t.checkout;
  const { refresh } = useAccountStatus();
  const walletGuard = useLinkedWalletGuard();
  const { address, isConnected, chainId, connector: activeConnector } = useAccount();
  const { connectors, connectAsync, isPending, error: connectError, reset: resetConnect } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [saving, setSaving] = useState(false);
  const [walletChangeMode, setWalletChangeMode] = useState(false);
  const [activeFlow, setActiveFlow] = useState<'coinbase' | 'walletconnect' | null>(null);
  const linkedRef = useRef<string | null>(walletGuard.linkedWallet);
  const syncedRef = useRef(false);
  const userInitiatedConnectRef = useRef(false);

  const coinbaseConnector = useMemo(() => pickConnector(connectors, 'coinbase'), [connectors]);
  const walletConnectConnector = useMemo(() => pickConnector(connectors, 'walletConnect'), [connectors]);

  const reportError = useCallback(
    (message: string | null) => {
      onError?.(message);
    },
    [onError]
  );

  const notifyLinked = useCallback(async () => {
    reportError(null);
    setWalletChangeMode(false);
    await refresh({ silent: true });
    await onLinked?.();
  }, [onLinked, refresh, reportError]);

  const beginWalletChange = useCallback(async () => {
    setWalletChangeMode(true);
    reportError(null);
    syncedRef.current = false;
    userInitiatedConnectRef.current = false;
    resetConnect();

    if (isConnected) {
      try {
        await disconnectAsync();
      } catch {
        /* user may cancel disconnect */
      }
    }
  }, [disconnectAsync, isConnected, reportError, resetConnect]);

  const cancelWalletChange = useCallback(() => {
    setWalletChangeMode(false);
    reportError(null);
  }, [reportError]);

  const linkWallet = useCallback(
    async (walletAddress: string, options?: { forceReplace?: boolean }) => {
      const normalized = walletAddress.toLowerCase();

      if (linkedRef.current === normalized) {
        await notifyLinked();
        return;
      }

      if (
        walletGuard.isWalletLinked &&
        walletGuard.linkedWallet !== normalized &&
        !(allowReplace && options?.forceReplace)
      ) {
        reportError(w.walletMismatch);
        return;
      }

      setSaving(true);

      try {
        const response = await fetch('/api/investor/wallet', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: normalized })
        });

        const data = (await response.json()) as { error?: string; walletAddress?: string };

        if (!response.ok) {
          const errorKey = data.error ?? 'GENERIC';
          reportError(
            t.onboarding.errors[errorKey as keyof typeof t.onboarding.errors] ?? t.onboarding.errors.GENERIC
          );
          return;
        }

        linkedRef.current = (data.walletAddress ?? normalized).toLowerCase();
        syncedRef.current = true;
        await notifyLinked();
      } catch {
        reportError(t.onboarding.errors.GENERIC);
      } finally {
        setSaving(false);
      }
    },
    [
      allowReplace,
      notifyLinked,
      reportError,
      t.onboarding.errors,
      walletGuard.isWalletLinked,
      walletGuard.linkedWallet,
      w.walletMismatch
    ]
  );

  const ensureBaseNetwork = useCallback(async () => {
    if (chainId === BASE_CHAIN_ID) {
      return true;
    }

    try {
      await switchChainAsync({ chainId: BASE_CHAIN_ID });
      return true;
    } catch {
      reportError(w.wrongNetwork);
      return false;
    }
  }, [chainId, reportError, switchChainAsync, w.wrongNetwork]);

  useEffect(() => {
    linkedRef.current = walletGuard.linkedWallet;
    if (!walletGuard.canSignOnChain) {
      syncedRef.current = false;
    }
  }, [walletGuard.canSignOnChain, walletGuard.linkedWallet]);

  useEffect(() => {
    if (!isConnected || !address || saving) {
      return;
    }

    if (walletGuard.isWalletMismatch && !allowReplace && !walletChangeMode) {
      reportError(w.walletMismatch);
      return;
    }

    if (walletGuard.isWalletMismatch && allowReplace && !walletChangeMode) {
      return;
    }

    void (async () => {
      const onBase = await ensureBaseNetwork();
      if (!onBase) {
        return;
      }

      const normalized = address.toLowerCase();

      if (walletGuard.isWalletLinked && walletGuard.linkedWallet === normalized) {
        if (!syncedRef.current) {
          syncedRef.current = true;
          await notifyLinked();
        }
        return;
      }

      if (!walletGuard.isWalletLinked) {
        await linkWallet(normalized);
        return;
      }

      if (allowReplace || walletChangeMode) {
        await linkWallet(normalized, { forceReplace: true });
      }
    })();
  }, [
    address,
    allowReplace,
    ensureBaseNetwork,
    isConnected,
    linkWallet,
    notifyLinked,
    reportError,
    saving,
    walletChangeMode,
    walletGuard.isWalletLinked,
    walletGuard.isWalletMismatch,
    walletGuard.linkedWallet,
    w.walletMismatch
  ]);

  useEffect(() => {
    if (!connectError || !userInitiatedConnectRef.current) {
      return;
    }

    userInitiatedConnectRef.current = false;
    reportError(
      humanizeConnectError(connectError, {
        connectFailed: w.connectFailed,
        connectRejected: w.connectRejected,
        walletConnectNotConfigured: t.onboarding.errors.WALLET_CONNECT_NOT_CONFIGURED
      })
    );
    resetConnect();
  }, [connectError, reportError, resetConnect, t.onboarding.errors.WALLET_CONNECT_NOT_CONFIGURED, w.connectFailed, w.connectRejected]);

  const beginConnect = useCallback(() => {
    userInitiatedConnectRef.current = true;
    reportError(null);
    resetConnect();
  }, [reportError, resetConnect]);

  const connectCoinbaseWallet = useCallback(async () => {
    if (!coinbaseConnector) {
      reportError(t.onboarding.errors.GENERIC);
      return;
    }

    beginConnect();
    setActiveFlow('coinbase');

    try {
      if (isConnected && activeConnector?.id !== coinbaseConnector.id) {
        await disconnectAsync();
      }

      await connectAsync({ connector: coinbaseConnector, chainId: BASE_CHAIN_ID });
    } catch (error) {
      userInitiatedConnectRef.current = false;
      reportError(
        humanizeConnectError(error, {
          connectFailed: w.connectFailed,
          connectRejected: w.connectRejected,
          walletConnectNotConfigured: t.onboarding.errors.WALLET_CONNECT_NOT_CONFIGURED
        })
      );
    }
  }, [
    activeConnector?.id,
    beginConnect,
    coinbaseConnector,
    connectAsync,
    disconnectAsync,
    isConnected,
    reportError,
    t.onboarding.errors.GENERIC,
    t.onboarding.errors.WALLET_CONNECT_NOT_CONFIGURED,
    w.connectFailed,
    w.connectRejected
  ]);

  const connectExistingWallet = useCallback(async () => {
    if (!walletConnectConnector) {
      reportError(t.onboarding.errors.WALLET_CONNECT_NOT_CONFIGURED);
      return;
    }

    beginConnect();
    setActiveFlow('walletconnect');

    try {
      if (isConnected && activeConnector?.id !== walletConnectConnector.id) {
        await disconnectAsync();
      }

      await connectAsync({ connector: walletConnectConnector, chainId: BASE_CHAIN_ID });
    } catch (error) {
      userInitiatedConnectRef.current = false;
      reportError(
        humanizeConnectError(error, {
          connectFailed: w.connectFailed,
          connectRejected: w.connectRejected,
          walletConnectNotConfigured: t.onboarding.errors.WALLET_CONNECT_NOT_CONFIGURED
        })
      );
    }
  }, [
    activeConnector?.id,
    beginConnect,
    connectAsync,
    disconnectAsync,
    isConnected,
    reportError,
    t.onboarding.errors.WALLET_CONNECT_NOT_CONFIGURED,
    w.connectFailed,
    w.connectRejected,
    walletConnectConnector
  ]);

  const busy = isPending || saving;
  const isOnboarding = variant === 'onboarding';
  const isDashboard = variant === 'dashboard';
  const displayAddress =
    walletGuard.linkedWallet ??
    linkedRef.current ??
    (walletGuard.canSignOnChain ? address?.toLowerCase() : null);

  const showReplaceWallet =
    !isDashboard &&
    allowReplace &&
    !walletChangeMode &&
    walletGuard.isWalletMismatch &&
    Boolean(address) &&
    Boolean(walletGuard.linkedWallet);
  const showConnectButtons = isDashboard
    ? walletChangeMode || !walletGuard.isWalletLinked
    : walletChangeMode || (!walletGuard.canSignOnChain && !showReplaceWallet);
  const showDashboardCurrentWallet =
    isDashboard && Boolean(walletGuard.linkedWallet) && !walletChangeMode;
  const showDashboardChangeButton = showDashboardCurrentWallet;
  const needsLinkedReconnect = walletGuard.isWalletLinked && !walletGuard.isConnected;
  const currentWalletAddress = walletGuard.linkedWallet ?? displayAddress;

  const currentWalletName = useMemo(() => {
    if (isConnected && walletGuard.canSignOnChain && activeConnector?.name) {
      return activeConnector.name;
    }
    if (activeFlow === 'coinbase') {
      return 'Coinbase Wallet';
    }
    if (activeFlow === 'walletconnect') {
      return 'WalletConnect';
    }
    return w.currentWalletLinkedName;
  }, [
    activeConnector?.name,
    activeFlow,
    isConnected,
    w.currentWalletLinkedName,
    walletGuard.canSignOnChain
  ]);
  const linkedAddressLabel = walletGuard.linkedWallet
    ? `${walletGuard.linkedWallet.slice(0, 6)}…${walletGuard.linkedWallet.slice(-4)}`
    : null;

  const dashboardChangeButtonClass =
    'flex w-full max-w-none items-center justify-center rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm font-semibold text-terminal-text transition hover:border-terminal-primary/50 disabled:opacity-50';

  const dashboardCurrentWalletFrame = showDashboardCurrentWallet && currentWalletAddress ? (
    <div className="w-full max-w-none rounded-lg border-2 border-amber-400/90 bg-amber-50 px-4 py-3.5 text-amber-950 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-900/80">{w.currentWalletTitle}</p>
      <p className="mt-1.5 text-sm font-semibold text-amber-950">{currentWalletName}</p>
      <p className="mt-1 break-all font-mono text-xs leading-relaxed text-amber-900/90">{currentWalletAddress}</p>
      {!walletGuard.canSignOnChain ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-800/90">{w.connectRetryWalletConnect}</p>
      ) : null}
    </div>
  ) : null;

  const connectButtonsLikeOnboarding = isOnboarding || (isDashboard && walletChangeMode);

  const primaryButtonClass = connectButtonsLikeOnboarding
    ? 'flex min-h-14 w-full max-w-none items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white disabled:opacity-60'
    : 'flex w-full max-w-none items-center justify-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-3 text-sm font-semibold text-terminal-primary hover:bg-terminal-primary/20 disabled:opacity-50';

  const secondaryButtonClass = connectButtonsLikeOnboarding
    ? 'flex min-h-14 w-full max-w-none items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-900 disabled:opacity-60'
    : 'flex w-full max-w-none items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm font-semibold text-terminal-text hover:border-terminal-primary/50 disabled:opacity-50';

  const linkedBadgeClass = isOnboarding
    ? 'rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-center text-sm font-semibold text-emerald-800'
    : 'rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-4 py-3 text-center text-sm font-semibold text-terminal-success';

  const walletConnectButton = (
    <button
      type="button"
      onClick={() => void connectExistingWallet()}
      disabled={busy || !isWalletConnectConfigured}
      className={needsLinkedReconnect ? primaryButtonClass : secondaryButtonClass}
    >
      {busy && activeFlow === 'walletconnect' ? (
        <>
          <Loader2 className="animate-spin" size={18} />
          {w.connecting}
        </>
      ) : (
        <>
          <Link2 size={18} />
          {w.connectWalletConnect}
        </>
      )}
    </button>
  );

  const coinbaseButton = (
    <button
      type="button"
      onClick={() => void connectCoinbaseWallet()}
      disabled={busy || !coinbaseConnector}
      className={needsLinkedReconnect ? secondaryButtonClass : primaryButtonClass}
    >
      {busy && activeFlow === 'coinbase' ? (
        <>
          <Loader2 className="animate-spin" size={18} />
          {w.connecting}
        </>
      ) : (
        <>
          <Wallet size={18} />
          {w.connectCoinbase}
        </>
      )}
    </button>
  );

  return (
    <div className={isOnboarding ? 'space-y-5' : 'space-y-3'}>
      {isOnboarding ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600">
              <Wallet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{o.walletTitle}</h2>
              <p className="text-sm text-slate-600">{o.walletDesc}</p>
            </div>
          </div>
          <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <li>{o.walletBullet1}</li>
            <li>{o.walletBullet2}</li>
            <li>{o.walletBullet3}</li>
          </ul>
        </>
      ) : isDashboard ? null : (
        <div>
          <p className="text-sm font-semibold text-terminal-text">{c.walletSectionTitle}</p>
          <p className="mt-1 text-xs text-terminal-muted">{c.walletSectionDesc}</p>
        </div>
      )}

      {dashboardCurrentWalletFrame}

      {showDashboardChangeButton ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void beginWalletChange()}
          className={dashboardChangeButtonClass}
        >
          {w.changeConnectedWallet}
        </button>
      ) : null}

      {isDashboard && walletGuard.isWalletMismatch && !walletChangeMode ? (
        <p className="w-full max-w-none text-xs font-medium text-terminal-warning">{w.walletMismatch}</p>
      ) : null}

      {displayAddress && walletGuard.canSignOnChain && !walletChangeMode && !isDashboard ? (
        <div className={`${linkedBadgeClass} space-y-3`}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              {o.walletSaving}
            </span>
          ) : (
            <>
              <p>
                {o.walletLinked}: {displayAddress.slice(0, 6)}…{displayAddress.slice(-4)}
              </p>
              {allowReplace ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void beginWalletChange()}
                  className={
                    isOnboarding
                      ? 'mx-auto flex w-full max-w-sm items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:border-blue-400'
                      : 'flex w-full items-center justify-center rounded-lg border border-terminal-border bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-text hover:border-terminal-primary/50'
                  }
                >
                  {w.changeWallet}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {showConnectButtons ? (
        <div className="w-full max-w-none space-y-3">
          {walletChangeMode ? (
            <div
              className={`w-full max-w-none space-y-2 rounded-lg border px-3 py-3 text-xs leading-relaxed ${
                isOnboarding
                  ? 'border-blue-200 bg-blue-50 text-slate-700'
                  : 'border-terminal-primary/30 bg-terminal-primary/5 text-terminal-muted'
              }`}
            >
              <p className="font-medium text-terminal-text">
                {isDashboard ? w.changeConnectedWallet : w.changeWallet}
              </p>
              <p className="text-pretty">{w.changeWalletHint}</p>
              {walletGuard.linkedWallet && !isDashboard ? (
                <p>
                  {w.linkedWalletLabel}:{' '}
                  <span className="font-mono">
                    {walletGuard.linkedWallet.slice(0, 6)}…{walletGuard.linkedWallet.slice(-4)}
                  </span>
                </p>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={cancelWalletChange}
                className={
                  isOnboarding
                    ? 'flex w-full max-w-none items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800'
                    : 'flex w-full max-w-none items-center justify-center rounded-lg border border-terminal-border bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-text'
                }
              >
                {w.cancelChangeWallet}
              </button>
            </div>
          ) : null}
          {needsLinkedReconnect && !walletChangeMode && !isDashboard ? (
            <p className={`text-xs ${isOnboarding ? 'text-slate-600' : 'text-terminal-muted'}`}>
              {linkedAddressLabel
                ? formatMessage(c.walletConnectPromptLinked, { address: linkedAddressLabel })
                : c.walletConnectPrompt}
            </p>
          ) : null}
          {needsLinkedReconnect && !walletChangeMode && !isDashboard ? (
            <p className={`text-xs ${isOnboarding ? 'text-slate-600' : 'text-terminal-muted'}`}>
              {w.connectRetryWalletConnect}
            </p>
          ) : null}
          {walletGuard.isWalletMismatch && !allowReplace ? (
            <p className={`text-xs font-medium ${isOnboarding ? 'text-red-600' : 'text-terminal-warning'}`}>
              {w.walletMismatch}
            </p>
          ) : null}
          {showReplaceWallet ? (
            <div
              className={`space-y-2 rounded-lg border px-3 py-3 text-xs ${
                isOnboarding
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-terminal-warning/30 bg-terminal-warning/10 text-terminal-muted'
              }`}
            >
              <p className="font-medium text-terminal-text">{w.replaceWalletTitle}</p>
              <p>{w.replaceWalletHint}</p>
              <p>
                {w.linkedWalletLabel}:{' '}
                <span className="font-mono">
                  {walletGuard.linkedWallet?.slice(0, 6)}…{walletGuard.linkedWallet?.slice(-4)}
                </span>
              </p>
              <p>
                {w.connectedWalletLabel}:{' '}
                <span className="font-mono">
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </span>
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void linkWallet(address!, { forceReplace: true })}
                className={
                  isOnboarding
                    ? 'mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60'
                    : 'mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50'
                }
              >
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    {o.walletSaving}
                  </>
                ) : (
                  w.replaceWalletButton
                )}
              </button>
            </div>
          ) : null}
          {walletGuard.isWrongNetwork ? (
            <p className={`text-xs font-medium ${isOnboarding ? 'text-amber-700' : 'text-terminal-warning'}`}>
              {w.wrongNetwork}
            </p>
          ) : null}

          {needsLinkedReconnect && !isDashboard ? (
            <>
              {walletConnectButton}
              {coinbaseButton}
            </>
          ) : (
            <>
              {coinbaseButton}
              {walletConnectButton}
            </>
          )}

          {!isWalletConnectConfigured ? (
            <p className={`text-center text-xs ${isOnboarding ? 'text-amber-700' : 'text-terminal-warning'}`}>
              {o.walletConnectUnavailable}
            </p>
          ) : null}
        </div>
      ) : null}

      {!isDashboard ? (
        <p className={`text-center text-xs ${isOnboarding ? 'text-slate-500' : 'text-terminal-muted'}`}>
          {isOnboarding ? o.walletHint : c.walletSectionHint}
        </p>
      ) : null}
    </div>
  );
}
