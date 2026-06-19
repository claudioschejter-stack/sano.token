'use client';

import { Check, Copy, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';

export type LaunchWalletBalanceRow = {
  id: string;
  label: string;
  address: string | null;
  configured: boolean;
  ethBalance: number | null;
  usdcBalance: number | null;
  minEthRequired: number;
  minUsdcRequired: number;
  ethSufficient: boolean;
  usdcSufficient: boolean;
  sufficient: boolean;
  detail?: string;
};

export type LaunchWalletBalancesReport = {
  chainId: number;
  chainName: string;
  explorerBaseUrl: string;
  usdcTokenAddress: string;
  morphoSeedUsdcRequired: number;
  wallets: LaunchWalletBalanceRow[];
  allSufficient: boolean;
  fetchedAt: string;
};

type AdminLaunchWalletBalancesProps = {
  totalTokens?: number;
  pricePerToken?: number;
};

function formatEth(value: number | null): string {
  if (value == null) return '—';
  return value.toFixed(4);
}

function formatUsdc(value: number | null): string {
  if (value == null) return '—';
  return value.toFixed(2);
}

export function AdminLaunchWalletBalances({ totalTokens, pricePerToken }: AdminLaunchWalletBalancesProps) {
  const t = useTranslation();
  const wb = t.adminLaunch.walletBalances;

  const [report, setReport] = useState<LaunchWalletBalancesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError(false);

    const params = new URLSearchParams();
    if (totalTokens != null && Number.isFinite(totalTokens) && totalTokens > 0) {
      params.set('totalTokens', String(totalTokens));
    }
    if (pricePerToken != null && Number.isFinite(pricePerToken) && pricePerToken > 0) {
      params.set('pricePerToken', String(pricePerToken));
    }

    try {
      const query = params.toString();
      const response = await fetch(
        `/api/admin/platform-wallet/balances${query ? `?${query}` : ''}`,
        { cache: 'no-store' }
      );
      if (!response.ok) throw new Error('fetch failed');
      setReport((await response.json()) as LaunchWalletBalancesReport);
    } catch {
      setError(true);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [totalTokens, pricePerToken]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard may be unavailable.
    }
  }, []);

  return (
    <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-card/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terminal-muted">{wb.title}</p>
          <p className="mt-1 text-xs text-terminal-muted">{wb.desc}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadBalances()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-terminal-border px-2 py-1 text-xs text-terminal-muted hover:border-terminal-primary/40 hover:text-terminal-text disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {wb.refresh}
        </button>
      </div>

      {loading && !report ? (
        <p className="mt-3 text-xs text-terminal-muted">{wb.loading}</p>
      ) : error ? (
        <p className="mt-3 text-xs text-red-400">{wb.error}</p>
      ) : report ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-terminal-muted">
            <span>
              {wb.chain}: {report.chainName} ({report.chainId})
            </span>
            {report.morphoSeedUsdcRequired > 0 ? (
              <span>
                · {wb.morphoSeedRequired}: {report.morphoSeedUsdcRequired.toFixed(2)} USDC
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2">
            {report.wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="rounded-lg border border-terminal-border bg-terminal-bg/70 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-terminal-text">{wallet.label}</p>
                  <span
                    className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      wallet.sufficient
                        ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                        : 'border border-red-400/50 bg-red-500/20 text-red-300'
                    }`}
                  >
                    {wallet.sufficient ? wb.statusOk : wb.statusInsufficient}
                  </span>
                </div>

                {wallet.address ? (
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <p className="break-all font-mono text-[11px] text-terminal-muted">{wallet.address}</p>
                    <button
                      type="button"
                      onClick={() => void handleCopy(wallet.address!, wallet.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-terminal-border px-2 py-1 text-[11px] text-terminal-muted hover:border-terminal-primary/40 hover:text-terminal-text"
                    >
                      {copiedKey === wallet.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedKey === wallet.id ? wb.copied : wb.copy}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-red-400">{wb.notConfigured}</p>
                )}

                <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  <span className={wallet.ethSufficient ? 'text-terminal-muted' : 'text-red-400'}>
                    ETH: {formatEth(wallet.ethBalance)}
                    {wallet.minEthRequired > 0 ? ` (${wb.min} ${wallet.minEthRequired})` : ''}
                  </span>
                  <span className={wallet.usdcSufficient ? 'text-terminal-muted' : 'text-red-400'}>
                    USDC: {formatUsdc(wallet.usdcBalance)}
                    {wallet.minUsdcRequired > 0 ? ` (${wb.min} ${wallet.minUsdcRequired.toFixed(2)})` : ''}
                  </span>
                </div>

                {wallet.detail ? (
                  <p className="mt-1 text-[11px] text-red-400">{wallet.detail}</p>
                ) : null}
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-terminal-muted">{wb.depositHint}</p>
        </>
      ) : null}
    </div>
  );
}
