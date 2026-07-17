'use client';

import Link from 'next/link';
import { ArrowLeft, Check, Clock3, ExternalLink, RefreshCw, Wallet, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { AdminGate } from './AdminGate';

type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'MANUAL_REVIEW' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
type WithdrawalFilter = WithdrawalStatus | 'ALL';

type FiatPayoutDetails = {
  rail?: string;
  accountHolderName?: string;
  taxId?: string;
  cbuOrCvu?: string | null;
  alias?: string | null;
  providerName?: string | null;
  notes?: string | null;
};

type AdminWithdrawalRow = {
  id: string;
  status: WithdrawalStatus;
  method: string;
  amountUsd: string;
  currency: string;
  stablecoinNetwork: string | null;
  destinationAddress: string | null;
  payoutDetails: FiatPayoutDetails | null;
  providerCheckoutUrl: string | null;
  txHash: string | null;
  createdAt: string;
  confirmedAt: string | null;
  investorEmail: string | null;
  investorName: string | null;
};

const FILTER_OPTIONS: WithdrawalFilter[] = ['ALL', 'PENDING', 'PROCESSING', 'MANUAL_REVIEW', 'CONFIRMED', 'FAILED', 'CANCELLED'];
const FULFILLABLE: WithdrawalStatus[] = ['PENDING', 'PROCESSING', 'MANUAL_REVIEW'];

function basescanTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
}

function statusBadgeClass(status: WithdrawalStatus): string {
  if (status === 'CONFIRMED') return 'border-terminal-success/30 text-terminal-success';
  if (status === 'FAILED') return 'border-red-500/30 text-red-400';
  if (status === 'CANCELLED') return 'border-terminal-border text-terminal-muted';
  return 'border-terminal-warning/30 text-terminal-warning';
}

function formatFiatDestination(details: FiatPayoutDetails | null): string {
  if (!details) return '—';
  const parts = [
    details.accountHolderName,
    details.cbuOrCvu ? `CBU/CVU ${details.cbuOrCvu}` : null,
    details.alias ? `Alias ${details.alias}` : null,
    details.providerName,
    details.taxId ? `CUIT/DNI ${details.taxId}` : null,
    details.notes
  ].filter(Boolean);
  return parts.join(' · ') || '—';
}

type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
};

function KpiCard({ label, value, hint, icon }: KpiCardProps) {
  return (
    <article className="rounded-xl border border-terminal-border bg-terminal-card p-6 shadow-[0_0_0_1px_rgba(31,41,55,0.5)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-terminal-muted">{label}</p>
          <p className="mt-3 font-mono text-2xl font-bold tracking-tight text-terminal-text">{value}</p>
          <p className="mt-2 text-xs text-terminal-muted">{hint}</p>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3 text-terminal-primary">{icon}</div>
      </div>
    </article>
  );
}

export function AdminWithdrawalsView() {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatUsd, formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const copy = t.adminWithdrawals;

  const [filter, setFilter] = useState<WithdrawalFilter>('ALL');
  const [rows, setRows] = useState<AdminWithdrawalRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeAction, setActiveAction] = useState<{ id: string; type: 'confirm' | 'reject' } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filterLabels = copy.filters as Record<WithdrawalFilter, string>;
  const statusLabels = copy.status as Record<WithdrawalStatus, string>;

  const load = useCallback(async (nextFilter: WithdrawalFilter) => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/admin/withdrawals?status=${nextFilter}`);
      if (!response.ok) {
        throw new Error('Failed to load withdrawals');
      }
      const data = (await response.json()) as { withdrawals: AdminWithdrawalRow[] };
      setRows(data.withdrawals);
    } catch {
      setError(true);
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const pendingRows = useMemo(() => (rows ?? []).filter((row) => FULFILLABLE.includes(row.status)), [rows]);
  const pendingTotalUsd = useMemo(
    () => pendingRows.reduce((sum, row) => sum + Number(row.amountUsd), 0),
    [pendingRows]
  );
  const oldestPending = useMemo(() => {
    if (!pendingRows.length) return null;
    return pendingRows.reduce((oldest, row) =>
      new Date(row.createdAt) < new Date(oldest.createdAt) ? row : oldest
    );
  }, [pendingRows]);

  const oldestAgeHint = useMemo(() => {
    if (!oldestPending) return copy.kpiOldestHint;
    const hours = Math.max(0, Math.round((Date.now() - new Date(oldestPending.createdAt).getTime()) / 3_600_000));
    return `${hours}h`;
  }, [oldestPending, copy.kpiOldestHint]);

  function startAction(id: string, type: 'confirm' | 'reject') {
    setActiveAction({ id, type });
    setInputValue('');
  }

  function cancelAction() {
    setActiveAction(null);
    setInputValue('');
  }

  async function submitConfirm(id: string) {
    if (!inputValue.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/withdrawals/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: inputValue.trim() })
      });
      if (!response.ok) {
        throw new Error('confirm failed');
      }
      setToast(copy.toastConfirmed);
      cancelAction();
      await load(filter);
    } catch {
      setToast(copy.toastError);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReject(id: string) {
    if (!inputValue.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: inputValue.trim() })
      });
      if (!response.ok) {
        throw new Error('reject failed');
      }
      setToast(copy.toastRejected);
      cancelAction();
      await load(filter);
    } catch {
      setToast(copy.toastError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminGate>
      <div className="mx-auto max-w-7xl space-y-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-terminal-muted transition-colors hover:text-terminal-primary"
        >
          <ArrowLeft size={16} />
          {t.adminDashboard.backToPanel}
        </Link>

        <header className="border-b border-terminal-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">{copy.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text">{copy.title}</h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">{copy.subtitle}</p>
        </header>

        {toast ? (
          <div className="rounded-lg border border-terminal-primary/30 bg-terminal-bg px-4 py-3 text-sm text-terminal-text">
            {toast}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <KpiCard
            label={copy.kpiPending}
            value={formatUsd(pendingTotalUsd)}
            hint={copy.kpiPendingHint.replace('{count}', String(pendingRows.length))}
            icon={<Wallet size={24} />}
          />
          <KpiCard label={copy.kpiOldest} value={oldestAgeHint} hint={copy.kpiOldestHint} icon={<Clock3 size={24} />} />
        </section>

        <section className="rounded-xl border border-terminal-border bg-terminal-card">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-terminal-border px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filter === option
                      ? 'border-terminal-primary/40 bg-terminal-bg text-terminal-primary'
                      : 'border-terminal-border text-terminal-muted hover:text-terminal-text'
                  }`}
                >
                  {filterLabels[option]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load(filter)}
              className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-3 py-1.5 text-xs text-terminal-muted transition-colors hover:text-terminal-text"
            >
              <RefreshCw size={14} />
              {copy.refresh}
            </button>
          </div>

          {loading ? (
            <p className="px-6 py-10 text-center text-sm text-terminal-muted">{copy.loading}</p>
          ) : error ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-red-400">{copy.error}</p>
              <button
                type="button"
                onClick={() => void load(filter)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-text transition-colors hover:border-terminal-primary/40"
              >
                <RefreshCw size={16} />
                {copy.refresh}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                  <tr>
                    <th className="px-6 py-3">{copy.colInvestor}</th>
                    <th className="px-6 py-3 text-right">{copy.colAmount}</th>
                    <th className="px-6 py-3">{copy.colDestination}</th>
                    <th className="px-6 py-3">{copy.colNetwork}</th>
                    <th className="px-6 py-3">{copy.colDate}</th>
                    <th className="px-6 py-3">{copy.colStatus}</th>
                    <th className="px-6 py-3">{copy.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-border">
                  {!rows?.length ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-terminal-muted">
                        {copy.emptyState}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const isActive = activeAction?.id === row.id;
                      const canAct = FULFILLABLE.includes(row.status);
                      const isFiat = row.method === 'FIAT';

                      return (
                        <tr key={row.id} className="transition-colors hover:bg-terminal-bg/60">
                          <td className="px-6 py-4">
                            <p className="font-medium text-terminal-text">{row.investorName || row.investorEmail}</p>
                            {row.investorName ? (
                              <p className="mt-1 text-xs text-terminal-muted">{row.investorEmail}</p>
                            ) : null}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-terminal-text">
                            {formatUsd(Number(row.amountUsd))}
                          </td>
                          <td className="max-w-xs px-6 py-4 text-xs text-terminal-muted">
                            {isFiat ? (
                              <span className="whitespace-pre-wrap break-words">{formatFiatDestination(row.payoutDetails)}</span>
                            ) : row.destinationAddress ? (
                              <span className="font-mono">{shortAddress(row.destinationAddress)}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-6 py-4 text-terminal-muted">
                            {isFiat ? copy.methodFiat : row.stablecoinNetwork ?? copy.methodStablecoin}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-terminal-muted">
                            {formatDateTime(row.createdAt)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                            >
                              {statusLabels[row.status] ?? row.status}
                            </span>
                            {row.txHash ? (
                              isFiat ? (
                                <p className="mt-1 text-xs text-terminal-muted">{row.txHash}</p>
                              ) : (
                                <a
                                  href={basescanTxUrl(row.txHash)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 flex items-center gap-1 text-xs text-terminal-primary hover:underline"
                                >
                                  {shortAddress(row.txHash)}
                                  <ExternalLink size={12} />
                                </a>
                              )
                            ) : null}
                          </td>
                          <td className="px-6 py-4">
                            {!canAct ? (
                              <span className="text-xs text-terminal-muted">—</span>
                            ) : isActive ? (
                              <div className="min-w-[240px] space-y-2">
                                <p className="text-xs font-semibold text-terminal-text">
                                  {activeAction.type === 'confirm' ? copy.confirmFormTitle : copy.rejectFormTitle}
                                </p>
                                <p className="text-xs text-terminal-muted">
                                  {activeAction.type === 'confirm'
                                    ? isFiat
                                      ? copy.confirmFormHintFiat
                                      : copy.confirmFormHint
                                    : copy.rejectFormHint}
                                </p>
                                {activeAction.type === 'confirm' ? (
                                  <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(event) => setInputValue(event.target.value)}
                                    placeholder={isFiat ? copy.referencePlaceholder : copy.txHashPlaceholder}
                                    className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-xs text-terminal-text"
                                  />
                                ) : (
                                  <textarea
                                    value={inputValue}
                                    onChange={(event) => setInputValue(event.target.value)}
                                    placeholder={copy.reasonPlaceholder}
                                    rows={2}
                                    className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs text-terminal-text"
                                  />
                                )}
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={submitting || !inputValue.trim()}
                                    onClick={() =>
                                      void (activeAction.type === 'confirm'
                                        ? submitConfirm(row.id)
                                        : submitReject(row.id))
                                    }
                                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-3 py-2 text-xs font-semibold text-terminal-primary disabled:opacity-50"
                                  >
                                    {submitting
                                      ? activeAction.type === 'confirm'
                                        ? copy.confirmSubmitting
                                        : copy.rejectSubmitting
                                      : activeAction.type === 'confirm'
                                        ? copy.confirmSubmit
                                        : copy.rejectSubmit}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={cancelAction}
                                    className="rounded-lg border border-terminal-border px-3 py-2 text-xs text-terminal-muted hover:text-terminal-text"
                                  >
                                    {copy.cancel}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startAction(row.id, 'confirm')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-terminal-success/30 px-3 py-2 text-xs font-semibold text-terminal-success"
                                >
                                  <Check size={14} />
                                  {copy.confirmAction}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startAction(row.id, 'reject')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-400"
                                >
                                  <X size={14} />
                                  {copy.rejectAction}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminGate>
  );
}
