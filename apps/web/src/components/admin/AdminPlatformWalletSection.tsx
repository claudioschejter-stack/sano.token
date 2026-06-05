'use client';

import { Check, Copy, ExternalLink, RefreshCw, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { PlatformWalletConfig } from '../../lib/admin/platformWalletConfig';
import { CoinbaseConnectButton } from '../wallet/CoinbaseConnectButton';

type PlatformWalletResponse = {
  config: PlatformWalletConfig;
};

function CopyableRow({
  label,
  value,
  envKey,
  configured,
  copiedKey,
  onCopy
}: {
  label: string;
  value: string | null;
  envKey?: string;
  configured?: boolean;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const t = useTranslation();
  const pw = t.adminSettings.platformWallet;
  const envReady = configured ?? Boolean(value);

  if (!value) {
    return (
      <div className="rounded-lg border border-dashed border-terminal-border bg-terminal-bg px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-terminal-text">{label}</p>
          <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
            {pw.envMissing}
          </span>
        </div>
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
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-terminal-text">{label}</p>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              {pw.envOk}
            </span>
          </div>
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
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              config.allOperationalConfigured
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
            }`}
          >
            <p className="font-medium">
              {config.allOperationalConfigured ? pw.envSummaryOk : pw.envSummaryMissing}
            </p>
            {!config.allOperationalConfigured && config.missingEnvKeys.length > 0 ? (
              <p className="mt-2 font-mono text-xs opacity-90">{config.missingEnvKeys.join(', ')}</p>
            ) : null}
          </div>

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
              configured={config.envEntries.find((entry) => entry.key === 'TOKEN_TREASURY_ADDRESS')?.configured}
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
            <CopyableRow
              label={pw.rwaOperator}
              value={config.rwaOperatorAddress}
              envKey="RWA_OPERATOR_ADDRESS"
              configured={config.envEntries.find((entry) => entry.key === 'RWA_OPERATOR_ADDRESS')?.configured}
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
            <CopyableRow
              label={pw.stablecoinTreasury}
              value={config.stablecoinTreasuryAddress}
              envKey="BASE_STABLECOIN_TREASURY_ADDRESS"
              configured={config.envEntries.find((entry) => entry.key === 'BASE_STABLECOIN_TREASURY_ADDRESS')?.configured}
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
            <CopyableRow
              label={pw.deployer}
              value={config.deployerAddress}
              envKey="TOKEN_DEPLOY_PRIVATE_KEY (derivada)"
              configured={config.envEntries.find((entry) => entry.key === 'TOKEN_DEPLOY_PRIVATE_KEY')?.configured}
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
          </div>

          <div className="rounded-lg border border-terminal-primary/20 bg-terminal-primary/5 px-4 py-4">
            <p className="text-sm font-medium text-terminal-text">{pw.connectTitle}</p>
            <p className="mt-1 text-sm text-terminal-muted">{pw.connectDesc}</p>

            <div className="mt-4 max-w-md">
              <CoinbaseConnectButton />
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
