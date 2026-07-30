'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowRight, Droplets, Loader2, RefreshCw } from 'lucide-react';
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
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const { intlLocale } = useLocale();
  const { formatUsd } = createIntlFormatters(intlLocale);
  const [snapshot, setSnapshot] = useState<MorphoLiquiditySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [seedingProjectId, setSeedingProjectId] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

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

  async function seedMarket(projectId: string) {
    setSeedingProjectId(projectId);
    setSeedMessage(null);
    try {
      const response = await fetch('/api/admin/operations/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false, projectIds: [projectId] })
      });
      const data = (await response.json()) as {
        error?: string;
        results?: Array<{ projectId: string; ok: boolean; morphoStatus?: string; error?: string }>;
      };
      if (!response.ok) {
        throw new Error(data.error ?? 'seed failed');
      }
      const row = data.results?.find((item) => item.projectId === projectId);
      if (row && !row.ok) {
        setSeedMessage(m.seedError.replace('{detail}', row.error ?? 'unknown'));
      } else {
        setSeedMessage(
          m.seedSuccess.replace('{status}', row?.morphoStatus ?? 'OK')
        );
      }
      await load({ silent: true });
    } catch (err) {
      setSeedMessage(
        m.seedError.replace(
          '{detail}',
          err instanceof Error ? err.message : 'request failed'
        )
      );
    } finally {
      setSeedingProjectId(null);
    }
  }

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
      {seedMessage ? <p className="mt-4 text-sm text-terminal-muted">{seedMessage}</p> : null}

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
            <p className="mt-1 text-xs text-terminal-warning">{m.baseNetworkHint}</p>
            <p className="mt-2 text-xs text-terminal-muted">{m.borrowOnSanovaHint}</p>
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
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && market.status !== 'LIQUID' ? (
                      <button
                        type="button"
                        disabled={seedingProjectId !== null}
                        onClick={() => void seedMarket(market.projectId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        {seedingProjectId === market.projectId ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            {m.seeding}
                          </>
                        ) : (
                          m.seedButton
                        )}
                      </button>
                    ) : null}
                    {market.borrowUrl ? (
                      <Link
                        href={market.borrowUrl}
                        className="inline-flex items-center gap-1 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-3 py-1.5 text-xs font-semibold text-terminal-primary hover:bg-terminal-primary/20"
                      >
                        {m.borrowLink}
                        <ArrowRight size={12} />
                      </Link>
                    ) : market.status === 'NO_LIQUIDITY' ? (
                      <span className="text-xs text-terminal-muted">{m.noLiquidityBorrow}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-terminal-muted">{m.footnote}</p>
          {isAdmin ? <p className="mt-2 text-xs text-terminal-muted">{m.seedHint}</p> : null}
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
