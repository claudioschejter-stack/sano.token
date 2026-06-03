'use client';

import { Loader2, Link2, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useConnect, useSwitchChain, type Connector } from 'wagmi';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import { useTranslation } from '../../i18n/LocaleProvider';
import { BASE_CHAIN_ID, isWalletConnectConfigured } from '../../lib/web3/config';

export type InvestorWalletLinkerProps = {
  variant?: 'onboarding' | 'checkout';
  onLinked?: () => void | Promise<void>;
  onError?: (message: string) => void;
};

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
  onLinked,
  onError
}: InvestorWalletLinkerProps) {
  const t = useTranslation();
  const o = t.onboarding.steps;
  const w = t.wallet;
  const c = t.checkout;
  const { refresh } = useAccountStatus();
  const walletGuard = useLinkedWalletGuard();
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync, isPending, error: connectError } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const [saving, setSaving] = useState(false);
  const [activeFlow, setActiveFlow] = useState<'coinbase' | 'walletconnect' | null>(null);
  const linkedRef = useRef<string | null>(walletGuard.linkedWallet);
  const syncedRef = useRef(false);

  const coinbaseConnector = useMemo(() => pickConnector(connectors, 'coinbase'), [connectors]);
  const walletConnectConnector = useMemo(() => pickConnector(connectors, 'walletConnect'), [connectors]);

  const reportError = useCallback(
    (message: string) => {
      onError?.(message);
    },
    [onError]
  );

  const notifyLinked = useCallback(async () => {
    await refresh({ silent: true });
    await onLinked?.();
  }, [onLinked, refresh]);

  const linkWallet = useCallback(
    async (walletAddress: string) => {
      const normalized = walletAddress.toLowerCase();

      if (linkedRef.current === normalized) {
        await notifyLinked();
        return;
      }

      if (walletGuard.isWalletLinked && walletGuard.linkedWallet !== normalized) {
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
        await notifyLinked();
      } catch {
        reportError(t.onboarding.errors.GENERIC);
      } finally {
        setSaving(false);
      }
    },
    [notifyLinked, reportError, t.onboarding.errors, walletGuard.isWalletLinked, walletGuard.linkedWallet, w.walletMismatch]
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

    if (walletGuard.isWalletMismatch) {
      reportError(w.walletMismatch);
      return;
    }

    void (async () => {
      const onBase = await ensureBaseNetwork();
      if (!onBase) {
        return;
      }

      if (walletGuard.isWalletLinked && walletGuard.linkedWallet === address.toLowerCase()) {
        if (!syncedRef.current) {
          syncedRef.current = true;
          await notifyLinked();
        }
        return;
      }

      if (!walletGuard.isWalletLinked) {
        await linkWallet(address);
      }
    })();
  }, [
    address,
    ensureBaseNetwork,
    isConnected,
    linkWallet,
    notifyLinked,
    reportError,
    saving,
    walletGuard.isWalletLinked,
    walletGuard.isWalletMismatch,
    walletGuard.linkedWallet,
    w.walletMismatch
  ]);

  useEffect(() => {
    if (connectError) {
      reportError(w.connectFailed);
    }
  }, [connectError, reportError, w.connectFailed]);

  const connectCoinbaseWallet = useCallback(async () => {
    if (!coinbaseConnector) {
      reportError(t.onboarding.errors.GENERIC);
      return;
    }

    setActiveFlow('coinbase');

    try {
      await connectAsync({ connector: coinbaseConnector, chainId: BASE_CHAIN_ID });
    } catch {
      reportError(w.connectFailed);
    }
  }, [coinbaseConnector, connectAsync, reportError, t.onboarding.errors.GENERIC, w.connectFailed]);

  const connectExistingWallet = useCallback(async () => {
    if (!walletConnectConnector) {
      reportError(t.onboarding.errors.WALLET_CONNECT_NOT_CONFIGURED);
      return;
    }

    setActiveFlow('walletconnect');

    try {
      await connectAsync({ connector: walletConnectConnector, chainId: BASE_CHAIN_ID });
    } catch {
      reportError(w.connectFailed);
    }
  }, [connectAsync, reportError, t.onboarding.errors.WALLET_CONNECT_NOT_CONFIGURED, w.connectFailed, walletConnectConnector]);

  const busy = isPending || saving;
  const displayAddress =
    walletGuard.linkedWallet ??
    linkedRef.current ??
    (walletGuard.canSignOnChain ? address?.toLowerCase() : null);

  const showConnectButtons = !walletGuard.canSignOnChain;
  const isOnboarding = variant === 'onboarding';

  const primaryButtonClass = isOnboarding
    ? 'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white disabled:opacity-60'
    : 'flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-3 text-sm font-semibold text-terminal-primary hover:bg-terminal-primary/20 disabled:opacity-50';

  const secondaryButtonClass = isOnboarding
    ? 'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-900 disabled:opacity-60'
    : 'flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm font-semibold text-terminal-text hover:border-terminal-primary/50 disabled:opacity-50';

  const linkedBadgeClass = isOnboarding
    ? 'rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-center text-sm font-semibold text-emerald-800'
    : 'rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-4 py-3 text-center text-sm font-semibold text-terminal-success';

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
      ) : (
        <div>
          <p className="text-sm font-semibold text-terminal-text">{c.walletSectionTitle}</p>
          <p className="mt-1 text-xs text-terminal-muted">{c.walletSectionDesc}</p>
        </div>
      )}

      {displayAddress && walletGuard.canSignOnChain ? (
        <div className={linkedBadgeClass}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              {o.walletSaving}
            </span>
          ) : (
            <>
              {o.walletLinked}: {displayAddress.slice(0, 6)}…{displayAddress.slice(-4)}
            </>
          )}
        </div>
      ) : null}

      {showConnectButtons ? (
        <div className="space-y-3">
          {walletGuard.isWalletLinked && !walletGuard.isConnected ? (
            <p className={`text-xs ${isOnboarding ? 'text-slate-600' : 'text-terminal-muted'}`}>{c.walletConnectPrompt}</p>
          ) : null}
          {walletGuard.isWalletMismatch ? (
            <p className={`text-xs font-medium ${isOnboarding ? 'text-red-600' : 'text-terminal-warning'}`}>
              {w.walletMismatch}
            </p>
          ) : null}
          {walletGuard.isWrongNetwork ? (
            <p className={`text-xs font-medium ${isOnboarding ? 'text-amber-700' : 'text-terminal-warning'}`}>
              {w.wrongNetwork}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void connectCoinbaseWallet()}
            disabled={busy || !coinbaseConnector}
            className={primaryButtonClass}
          >
            {busy && activeFlow === 'coinbase' ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {w.connecting}
              </>
            ) : (
              <>
                <Wallet size={18} />
                {o.createCoinbaseWallet}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void connectExistingWallet()}
            disabled={busy || !isWalletConnectConfigured}
            className={secondaryButtonClass}
          >
            {busy && activeFlow === 'walletconnect' ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {w.connecting}
              </>
            ) : (
              <>
                <Link2 size={18} />
                {o.connectExistingWallet}
              </>
            )}
          </button>

          {!isWalletConnectConfigured ? (
            <p className={`text-center text-xs ${isOnboarding ? 'text-amber-700' : 'text-terminal-warning'}`}>
              {o.walletConnectUnavailable}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className={`text-center text-xs ${isOnboarding ? 'text-slate-500' : 'text-terminal-muted'}`}>
        {isOnboarding ? o.walletHint : c.walletSectionHint}
      </p>
    </div>
  );
}
