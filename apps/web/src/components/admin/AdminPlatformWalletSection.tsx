'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Check, Copy, ExternalLink, RefreshCw, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { PlatformWalletConfig } from '../../lib/admin/platformWalletConfig';
import { isWalletConnectConfigured } from '../../lib/web3/config';

type PlatformWalletResponse = {
  config: PlatformWalletConfig;
};

function CopyableRow({
  label,
  value,
  envKey,
  copiedKey,
  onCopy
}: {
  label: string;
  value: string | null;
  envKey?: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const t = useTranslation();
  const pw = t.adminSettings.platformWallet;

  if (!value) {
    return (
      <div className="rounded-lg border border-dashed border-terminal-border bg-terminal-bg px-4 py-3">
        <p className="text-sm font-medium text-terminal-text">{label}</p>
        {envKey ? (
          <p className="mt-1 font-mono text-xs text-terminal-muted">
            {pw.envVar}: {envKey}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-terminal-muted">{pw.notSet}</p>
      </div>
    );
  }

  const copyId = envKey ?? label;

  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-terminal-text">{label}</p>
          {envKey ? (
            <p className="mt-1 font-mono text-xs text-terminal-muted">
              {pw.envVar}: {envKey}
            </p>
          ) : null}
          <p className="mt-2 break-all font-mono text-xs text-terminal-text">{value}</p>
        </div>
        <button
          type="button"
          onClick={() => onCopy(value, copyId)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-terminal-border px-2 py-1 text-xs text-terminal-muted transition-colors hover:border-terminal-primary/40 hover:text-terminal-text"
        >
          {copiedKey === copyId ? <Check size={14} /> : <Copy size={14} />}
          {copiedKey === copyId ? pw.copied : pw.copy}
        </button>
      </div>
    </div>
  );
}

export function AdminPlatformWalletSection() {
  const t = useTranslation();
  const pw = t.adminSettings.platformWallet;
  const w = t.wallet;

  const [config, setConfig] = useState<PlatformWalletConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch('/api/admin/platform-wallet', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load platform wallet config');
      }

      const data = (await response.json()) as PlatformWalletResponse;
      setConfig(data.config);
    } catch {
      setError(true);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard may be unavailable in some contexts.
    }
  }, []);

  const connectLabel = isWalletConnectConfigured ? w.connect : w.connectCoinbase;

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-terminal-primary" />
            <h2 className="text-lg font-semibold text-terminal-text">{pw.title}</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-terminal-muted">{pw.desc}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadConfig()}
          className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-text transition-colors hover:border-terminal-primary/40"
        >
          <RefreshCw size={16} />
          {pw.refresh}
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-terminal-muted">{pw.loading}</p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-400">{pw.error}</p>
      ) : config ? (
        <div className="mt-6 space-y-6">
          <div className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm">
            <p className="text-terminal-muted">{pw.chainLabel}</p>
            <p className="mt-1 font-medium text-terminal-text">
              {config.chainName} · chainId {config.chainId}
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <CopyableRow
              label={pw.tokenTreasury}
              value={config.tokenTreasuryAddress}
              envKey="TOKEN_TREASURY_ADDRESS"
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
            <CopyableRow
              label={pw.rwaOperator}
              value={config.rwaOperatorAddress}
              envKey="RWA_OPERATOR_ADDRESS"
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
            <CopyableRow
              label={pw.stablecoinTreasury}
              value={config.stablecoinTreasuryAddress}
              envKey="BASE_STABLECOIN_TREASURY_ADDRESS"
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
            <CopyableRow
              label={pw.deployer}
              value={config.deployerAddress}
              envKey="TOKEN_DEPLOY_PRIVATE_KEY (derivada)"
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
          </div>

          <div className="rounded-lg border border-terminal-primary/20 bg-terminal-primary/5 px-4 py-4">
            <p className="text-sm font-medium text-terminal-text">{pw.connectTitle}</p>
            <p className="mt-1 text-sm text-terminal-muted">{pw.connectDesc}</p>

            <div className="mt-4 max-w-md">
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
                        {w.wrongNetwork}
                      </button>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={openAccountModal}
                        className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm font-semibold text-terminal-text hover:border-terminal-primary/50"
                      >
                        {account.displayName}
                      </button>
                      <div className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3">
                        <p className="text-xs text-terminal-muted">{pw.connectedAddress}</p>
                        <p className="mt-1 break-all font-mono text-xs text-terminal-text">{account.address}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCopy(account.address ?? '', 'connected-wallet')}
                            className="inline-flex items-center gap-1 rounded-md border border-terminal-border px-2 py-1 text-xs text-terminal-muted hover:text-terminal-text"
                          >
                            {copiedKey === 'connected-wallet' ? <Check size={14} /> : <Copy size={14} />}
                            {copiedKey === 'connected-wallet' ? pw.copied : pw.copy}
                          </button>
                          <a
                            href={`${config.explorerBaseUrl}/address/${account.address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-terminal-border px-2 py-1 text-xs text-terminal-primary hover:border-terminal-primary/40"
                          >
                            <ExternalLink size={14} />
                            {pw.viewExplorer}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>

          <p className="rounded-lg border border-dashed border-terminal-border bg-terminal-bg px-4 py-3 text-xs text-terminal-muted">
            {pw.vercelNote}
          </p>
        </div>
      ) : null}
    </section>
  );
}
