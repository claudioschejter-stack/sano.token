'use client';

import Link from 'next/link';
import { Droplets, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { MorphoLiquiditySnapshot } from '../../lib/lending/morphoLiquiditySnapshot';

type MorphoLiquidityPanelProps = {
  loansHref?: string;
  showLoansLink?: boolean;
};

export function MorphoLiquidityPanel({
  loansHref = '/dashboard/loans',
  showLoansLink = true
}: MorphoLiquidityPanelProps) {
  const t = useTranslation();
  const m = t.morphoLiquidityPanel;
  const { intlLocale } = useLocale();
  const { formatUsd } = createIntlFormatters(intlLocale);
  const [snapshot, setSnapshot] = useState<MorphoLiquiditySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(false);

    try {
      const response = await fetch('/api/lending/morpho-liquidity', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('load failed');
      }
      const data = (await response.json()) as MorphoLiquiditySnapshot;
      setSnapshot(data);
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
    }, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  function statusLabel(status: string): string {
    const labels = m.statuses as Record<string, string>;
    return labels[status] ?? status;
  }

  function statusClass(status: string): string {
    if (status === 'LIQUID') return 'text-terminal-success';
    if (status === 'NO_LIQUIDITY') return 'text-amber-400';
    if (status === 'FAILED') return 'text-red-400';
    return 'text-terminal-muted';
  }

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3 text-terminal-primary">
            <Droplets size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-terminal-text">{m.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-terminal-muted">{m.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={loading || refreshing}
          onClick={() => void load({ silent: true })}
          className="inline-flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text hover:border-terminal-primary/40 disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {m.refresh}
        </button>
      </div>

      {loading && !snapshot ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-terminal-muted">
          <Loader2 size={16} className="animate-spin" />
          {m.loading}
        </div>
      ) : null}

      {error ? <p className="mt-6 text-sm text-red-400">{m.error}</p> : null}

      {snapshot ? (
        <>
          <div className="mt-6 rounded-lg border border-terminal-primary/25 bg-terminal-bg px-4 py-4">
            <p className="text-sm text-terminal-muted">{m.availableLabel}</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-terminal-text">
              {formatUsd(snapshot.totalAvailableUsdc)}
            </p>
            <p className="mt-2 text-xs text-terminal-muted">
              {m.chainHint.replace('{chainId}', String(snapshot.chainId))}
              {snapshot.updatedAt ? ` · ${m.updated} ${new Date(snapshot.updatedAt).toLocaleString(intlLocale)}` : ''}
            </p>
          </div>

          {snapshot.markets.length === 0 ? (
            <p className="mt-4 text-sm text-terminal-muted">{m.empty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-terminal-border rounded-lg border border-terminal-border bg-terminal-bg">
              {snapshot.markets.map((market) => (
                <li key={market.projectId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-terminal-text">{market.title}</p>
                    <p className={`mt-0.5 text-xs ${statusClass(market.status)}`}>{statusLabel(market.status)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-terminal-text">{formatUsd(market.availableUsdc)}</p>
                    <p className="text-xs text-terminal-muted">
                      {m.supplyBorrow
                        .replace('{supply}', formatUsd(market.totalSupplyUsdc))
                        .replace('{borrow}', formatUsd(market.totalBorrowUsdc))}
                    </p>
                  </div>
                  {market.poolUrl ? (
                    <a
                      href={market.poolUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-terminal-primary hover:underline"
                    >
                      Morpho
                      <ExternalLink size={12} />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-terminal-muted">{m.footnote}</p>
          {showLoansLink ? (
            <Link
              href={loansHref}
              className="mt-3 inline-flex text-sm font-medium text-terminal-primary hover:underline"
            >
              {m.loansLink}
            </Link>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
