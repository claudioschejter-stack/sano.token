'use client';

import Link from 'next/link';
import { ExternalLink, Landmark, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';

export type PrivyEarnVaultRow = {
  vaultId: string;
  name: string;
  provider: string;
  vaultAddress: string;
  assetSymbol: string;
  userApyPercent: number;
  tvlUsd: number;
  availableLiquidityUsd: number;
  projectId: string | null;
  projectTitle: string | null;
  checkoutHref: string;
};

type PrivyEarnVaultsPanelProps = {
  compact?: boolean;
  hideChrome?: boolean;
  className?: string;
};

export function PrivyEarnVaultsPanel({ compact = false, hideChrome = false, className = '' }: PrivyEarnVaultsPanelProps) {
  const t = useTranslation();
  const p = t.privyEarnVaultsPanel;
  const { intlLocale } = useLocale();
  const { formatUsd, formatPercent } = createIntlFormatters(intlLocale);
  const [vaults, setVaults] = useState<PrivyEarnVaultRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(false);
    setNotConfigured(false);

    try {
      const response = await fetch('/api/privy/earn/vaults', { cache: 'no-store' });
      if (response.status === 503) {
        setNotConfigured(true);
        setVaults([]);
        return;
      }
      if (!response.ok) {
        throw new Error('load failed');
      }
      const data = (await response.json()) as { vaults?: PrivyEarnVaultRow[]; updatedAt?: string };
      setVaults(data.vaults ?? []);
      setUpdatedAt(data.updatedAt ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load({ silent: true });
    }, 120_000);
    return () => clearInterval(timer);
  }, [load]);

  if (notConfigured) {
    return null;
  }

  return (
    <section
      className={`${hideChrome ? '' : `rounded-xl border border-terminal-border bg-terminal-card p-6 ${compact ? 'p-4' : ''}`} ${className}`}
    >
      {!hideChrome ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3 text-terminal-primary">
              <Landmark size={compact ? 18 : 22} />
            </div>
            <div>
              <h2 className={`font-bold text-terminal-text ${compact ? 'text-base' : 'text-lg'}`}>{p.title}</h2>
              <p className={`mt-1 max-w-2xl text-terminal-muted ${compact ? 'text-xs' : 'text-sm'}`}>{p.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => void load({ silent: true })}
            className="inline-flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text hover:border-terminal-primary/40 disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {p.refresh}
          </button>
        </div>
      ) : null}

      {loading && vaults.length === 0 ? (
        <div className={`flex items-center gap-2 text-sm text-terminal-muted ${hideChrome ? '' : 'mt-6'}`}>
          <Loader2 size={16} className="animate-spin" />
          {p.loading}
        </div>
      ) : null}

      {error ? <p className="mt-6 text-sm text-red-400">{p.error}</p> : null}

      {!loading && !error && vaults.length === 0 ? (
        <p className="mt-6 text-sm text-terminal-muted">{p.empty}</p>
      ) : null}

      {vaults.length > 0 ? (
        <>
          <ul className="mt-4 divide-y divide-terminal-border rounded-lg border border-terminal-border bg-terminal-bg">
            {vaults.map((vault) => (
              <li key={vault.vaultId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-terminal-text">{vault.name}</p>
                  {vault.projectTitle && vault.projectTitle !== vault.name ? (
                    <p className="mt-0.5 truncate text-xs text-terminal-muted">{vault.projectTitle}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-terminal-muted">
                    {vault.assetSymbol || 'USDC'}
                    {vault.vaultAddress
                      ? ` · ${vault.vaultAddress.slice(0, 6)}…${vault.vaultAddress.slice(-4)}`
                      : ''}
                  </p>
                  {!compact ? (
                    <p className="mt-1 text-xs text-terminal-muted">
                      {p.tvlLabel}: {formatUsd(vault.tvlUsd)}
                      {' · '}
                      {p.liquidityLabel}: {formatUsd(vault.availableLiquidityUsd)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
                      {p.apyLabel}
                    </p>
                    <p className="font-mono text-lg font-bold text-terminal-success">
                      {formatPercent(vault.userApyPercent)}
                    </p>
                  </div>

                  <Link
                    href={vault.checkoutHref}
                    className="inline-flex items-center justify-center rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    {p.depositButton}
                  </Link>

                  {vault.vaultAddress ? (
                    <a
                      href={`https://basescan.org/address/${vault.vaultAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-terminal-primary hover:underline"
                      aria-label={p.explorerLabel}
                    >
                      Base
                      <ExternalLink size={12} />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {updatedAt && !hideChrome ? (
            <p className="mt-3 text-xs text-terminal-muted">
              {p.updated} {new Date(updatedAt).toLocaleString(intlLocale)}
            </p>
          ) : null}

          {!hideChrome ? <p className="mt-2 text-xs text-terminal-muted">{p.footnote}</p> : null}
        </>
      ) : null}
    </section>
  );
}
