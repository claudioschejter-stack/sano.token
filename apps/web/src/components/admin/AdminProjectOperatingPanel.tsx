'use client';

import Link from 'next/link';
import { ArrowLeft, Banknote, Loader2, RefreshCw, Send, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { AdminAssetRecord } from '../../lib/admin/assetsService';
import { AdminGate } from './AdminGate';

type OperatingSummary = {
  projectId: string;
  vaultAddress: string | null;
  chainId: number | null;
  accounts: Array<{ currency: string; balance: string; balanceUsdEstimate: number }>;
  ledger: Array<{
    id: string;
    type: string;
    amount: string;
    currency: string;
    balanceAfter: string;
    batchId: string | null;
    createdAt: string;
  }>;
  batches: Array<{
    id: string;
    status: string;
    sourceCurrency: string;
    sourceAmount: string;
    conversionRail: string | null;
    createdAt: string;
  }>;
};

type AllocationRow = {
  investorId: string;
  tokenCount: number;
  amountUsd: number;
  preference: string;
  result: { mode?: string; skipped?: boolean; netRentUsd?: number };
};

type AdminProjectOperatingPanelProps = {
  projectId: string;
};

const CURRENCIES = ['USD', 'ARS'] as const;

function formatLedgerType(type: string, labels: Record<string, string>): string {
  return labels[type] ?? type;
}

export function AdminProjectOperatingPanel({ projectId }: AdminProjectOperatingPanelProps) {
  const t = useTranslation();
  const o = t.adminOperating;
  const { intlLocale } = useLocale();
  const { formatUsd, formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [asset, setAsset] = useState<AdminAssetRecord | null>(null);
  const [summary, setSummary] = useState<OperatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'credit' | 'distribute' | 'convert' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastAllocations, setLastAllocations] = useState<AllocationRow[]>([]);

  const [creditAmount, setCreditAmount] = useState('');
  const [creditCurrency, setCreditCurrency] = useState<(typeof CURRENCIES)[number]>('ARS');
  const [bankRef, setBankRef] = useState('');
  const [period, setPeriod] = useState('');
  const [distributeAmount, setDistributeAmount] = useState('');

  const totalUsdEstimate = useMemo(
    () => summary?.accounts.reduce((sum, row) => sum + row.balanceUsdEstimate, 0) ?? 0,
    [summary]
  );

  const selectedAccount = useMemo(
    () => summary?.accounts.find((row) => row.currency === creditCurrency) ?? null,
    [creditCurrency, summary]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [assetResponse, operatingResponse] = await Promise.all([
        fetch(`/api/admin/assets/${projectId}`, { cache: 'no-store' }),
        fetch(`/api/admin/projects/${projectId}/operating`, { cache: 'no-store' })
      ]);

      if (!assetResponse.ok) {
        throw new Error('ASSET_NOT_FOUND');
      }

      const assetData = (await assetResponse.json()) as { asset: AdminAssetRecord };
      setAsset(assetData.asset);

      if (operatingResponse.ok) {
        const operatingData = (await operatingResponse.json()) as OperatingSummary;
        setSummary(operatingData);
      } else {
        setSummary(null);
      }
    } catch {
      setError(o.errorLoad);
      setAsset(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [o.errorLoad, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCredit() {
    const amount = Number.parseFloat(creditAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(o.validationAmount);
      return;
    }

    setBusy('credit');
    setError(null);
    setSuccess(null);

    try {
      const idempotencyKey = `rent-credit:${projectId}:${creditCurrency}:${period.trim() || bankRef.trim() || Date.now()}`;
      const response = await fetch(`/api/admin/projects/${projectId}/operating/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: creditCurrency,
          idempotencyKey,
          metadata: {
            bankRef: bankRef.trim() || null,
            period: period.trim() || null
          }
        })
      });

      const data = (await response.json()) as { error?: string; entry?: { balanceAfter: string } };
      if (!response.ok) {
        throw new Error(data.error ?? 'CREDIT_FAILED');
      }

      setSuccess(o.creditSuccess);
      setCreditAmount('');
      setBankRef('');
      setLastAllocations([]);
      await load();
    } catch (creditError) {
      setError(creditError instanceof Error ? creditError.message : o.creditError);
    } finally {
      setBusy(null);
    }
  }

  async function handleDistribute() {
    const parsed = distributeAmount.trim()
      ? Number.parseFloat(distributeAmount.replace(',', '.'))
      : undefined;

    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError(o.validationAmount);
      return;
    }

    const available = selectedAccount?.balance ? Number.parseFloat(selectedAccount.balance) : 0;
    const amountToSend = parsed ?? available;

    if (amountToSend <= 0) {
      setError(o.noBalance);
      return;
    }

    if (
      !window.confirm(
        o.confirmDistribute.replace('{amount}', String(amountToSend)).replace('{currency}', creditCurrency)
      )
    ) {
      return;
    }

    setBusy('distribute');
    setError(null);
    setSuccess(null);

    try {
      const body: { currency: string; amount?: number } = { currency: creditCurrency };
      if (parsed != null) {
        body.amount = parsed;
      }

      const response = await fetch(`/api/admin/projects/${projectId}/operating/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = (await response.json()) as {
        error?: string;
        totalAmountUsd?: number;
        allocation?: { allocations?: AllocationRow[]; status?: string };
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'DISTRIBUTE_FAILED');
      }

      setLastAllocations(data.allocation?.allocations ?? []);
      setSuccess(
        o.distributeSuccess.replace(
          '{usd}',
          formatUsd(data.totalAmountUsd ?? 0)
        )
      );
      setDistributeAmount('');
      await load();
    } catch (distributeError) {
      setError(distributeError instanceof Error ? distributeError.message : o.distributeError);
    } finally {
      setBusy(null);
    }
  }

  async function handleConvert() {
    setBusy('convert');
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/projects/${projectId}/operating/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: creditCurrency })
      });

      const data = (await response.json()) as { error?: string; batch?: { id: string; status: string } };
      if (!response.ok) {
        throw new Error(data.error ?? 'CONVERT_FAILED');
      }

      setSuccess(o.convertSuccess.replace('{id}', data.batch?.id ?? '—'));
      await load();
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : o.convertError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminGate>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/dashboard/assets"
              className="inline-flex items-center gap-1 text-sm text-terminal-muted hover:text-terminal-primary"
            >
              <ArrowLeft size={16} />
              {o.backToAssets}
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-terminal-text">{o.title}</h1>
            <p className="mt-1 text-sm text-terminal-muted">{o.subtitle}</p>
            {asset ? (
              <p className="mt-2 text-sm font-medium text-terminal-text">
                {asset.title}{' '}
                <span className="font-mono text-xs text-terminal-muted">({asset.tokenSymbol})</span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted hover:text-terminal-text disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {o.refresh}
          </button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-terminal-muted">
            <Loader2 size={16} className="animate-spin" />
            {o.loading}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
        ) : null}

        {success ? (
          <p className="rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-4 py-3 text-sm text-terminal-success">
            {success}
          </p>
        ) : null}

        {!loading && summary ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
                <p className="text-xs uppercase tracking-wide text-terminal-muted">{o.kpiTotalUsd}</p>
                <p className="mt-2 font-mono text-2xl font-bold text-terminal-text">{formatUsd(totalUsdEstimate)}</p>
              </article>
              {summary.accounts.map((account) => (
                <article
                  key={account.currency}
                  className="rounded-xl border border-terminal-border bg-terminal-card p-5"
                >
                  <p className="text-xs uppercase tracking-wide text-terminal-muted">
                    {o.kpiBalance.replace('{currency}', account.currency)}
                  </p>
                  <p className="mt-2 font-mono text-xl font-bold text-terminal-text">
                    {Number.parseFloat(account.balance).toLocaleString(intlLocale, {
                      maximumFractionDigits: 2
                    })}{' '}
                    {account.currency}
                  </p>
                  <p className="mt-1 text-xs text-terminal-muted">≈ {formatUsd(account.balanceUsdEstimate)}</p>
                </article>
              ))}
            </div>

            <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
              <div className="flex items-center gap-2">
                <Banknote size={18} className="text-terminal-primary" />
                <h2 className="text-lg font-semibold text-terminal-text">{o.creditTitle}</h2>
              </div>
              <p className="mt-2 text-sm text-terminal-muted">{o.creditDesc}</p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-terminal-muted">{o.fieldCurrency}</span>
                  <select
                    value={creditCurrency}
                    onChange={(event) => setCreditCurrency(event.target.value as (typeof CURRENCIES)[number])}
                    className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-terminal-muted">{o.fieldAmount}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={creditAmount}
                    onChange={(event) => setCreditAmount(event.target.value)}
                    placeholder="1500000"
                    className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-terminal-muted">{o.fieldPeriod}</span>
                  <input
                    type="text"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    placeholder="2026-03"
                    className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-terminal-muted">{o.fieldBankRef}</span>
                  <input
                    type="text"
                    value={bankRef}
                    onChange={(event) => setBankRef(event.target.value)}
                    placeholder={o.fieldBankRefPlaceholder}
                    className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleCredit()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {busy === 'credit' ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                {o.creditButton}
              </button>
            </section>

            <section className="rounded-xl border border-terminal-primary/30 bg-terminal-primary/5 p-6">
              <div className="flex items-center gap-2">
                <Send size={18} className="text-terminal-primary" />
                <h2 className="text-lg font-semibold text-terminal-text">{o.distributeTitle}</h2>
              </div>
              <p className="mt-2 text-sm text-terminal-muted">{o.distributeDesc}</p>

              <label className="mt-4 block max-w-sm text-sm">
                <span className="text-terminal-muted">{o.fieldDistributeAmount}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={distributeAmount}
                  onChange={(event) => setDistributeAmount(event.target.value)}
                  placeholder={selectedAccount?.balance ?? o.distributeAllHint}
                  className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
                />
                <span className="mt-1 block text-xs text-terminal-muted">{o.distributeAllHint}</span>
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void handleDistribute()}
                  className="inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {busy === 'distribute' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {o.distributeButton}
                </button>
                {summary.vaultAddress ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void handleConvert()}
                    className="inline-flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg px-4 py-2.5 text-sm font-semibold text-terminal-text hover:border-terminal-primary/40 disabled:opacity-50"
                  >
                    {busy === 'convert' ? <Loader2 size={16} className="animate-spin" /> : null}
                    {o.convertButton}
                  </button>
                ) : null}
              </div>
            </section>

            {lastAllocations.length > 0 ? (
              <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
                <h2 className="text-lg font-semibold text-terminal-text">{o.allocationsTitle}</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-terminal-muted">
                      <tr>
                        <th className="py-2 pr-4">{o.colInvestor}</th>
                        <th className="py-2 pr-4">{o.colTokens}</th>
                        <th className="py-2 pr-4">{o.colAmount}</th>
                        <th className="py-2">{o.colMode}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-terminal-border">
                      {lastAllocations.map((row) => (
                        <tr key={row.investorId}>
                          <td className="py-2 pr-4 font-mono text-xs">{row.investorId.slice(0, 10)}…</td>
                          <td className="py-2 pr-4">{row.tokenCount}</td>
                          <td className="py-2 pr-4 font-mono">{formatUsd(row.amountUsd)}</td>
                          <td className="py-2">{row.preference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {summary.ledger.length > 0 ? (
              <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
                <h2 className="text-lg font-semibold text-terminal-text">{o.ledgerTitle}</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-terminal-muted">
                      <tr>
                        <th className="py-2 pr-4">{o.colDate}</th>
                        <th className="py-2 pr-4">{o.colType}</th>
                        <th className="py-2 pr-4">{o.colAmount}</th>
                        <th className="py-2">{o.colBalance}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-terminal-border">
                      {summary.ledger.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-2 pr-4 text-terminal-muted">{formatDateTime(entry.createdAt)}</td>
                          <td className="py-2 pr-4">{formatLedgerType(entry.type, o.ledgerTypes as Record<string, string>)}</td>
                          <td className="py-2 pr-4 font-mono">
                            {Number.parseFloat(entry.amount).toLocaleString(intlLocale)} {entry.currency}
                          </td>
                          <td className="py-2 font-mono text-terminal-muted">
                            {Number.parseFloat(entry.balanceAfter).toLocaleString(intlLocale)} {entry.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminGate>
  );
}
