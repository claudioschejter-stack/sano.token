'use client';

import Link from 'next/link';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type {
  AdvisorCommissionRow,
  AdvisorCommissionSummary
} from '../../lib/advisor/commissionService';
import { AdvisorGate } from './AdvisorGate';

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AdvisorCommissionsView() {
  const t = useTranslation();
  const labels = t.advisorPortal.commissions;
  const { intlLocale } = useLocale();
  const { formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [summary, setSummary] = useState<AdvisorCommissionSummary | null>(null);
  const [rows, setRows] = useState<AdvisorCommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch('/api/advisor/commissions');
      if (!response.ok) {
        throw new Error('Failed');
      }
      const data = (await response.json()) as {
        summary: AdvisorCommissionSummary;
        rows: AdvisorCommissionRow[];
      };
      setSummary(data.summary);
      setRows(data.rows);
    } catch {
      setError(true);
      setSummary(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExport() {
    setExporting(true);
    try {
      const response = await fetch('/api/advisor/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export' })
      });
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'commission-distribution.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — user can retry
    } finally {
      setExporting(false);
    }
  }

  const eventLabels = labels.eventTypes as Record<string, string>;
  const statusLabels = labels.statuses as Record<string, string>;

  return (
    <AdvisorGate>
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-terminal-muted transition-colors hover:text-terminal-primary"
        >
          <ArrowLeft size={16} />
          {t.adminDashboard.backToPanel}
        </Link>

        <header className="border-b border-terminal-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
            {labels.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text">{labels.title}</h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">{labels.desc}</p>
        </header>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {labels.refresh}
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-3 py-2 text-sm font-semibold text-terminal-primary disabled:opacity-50"
          >
            <Download size={16} />
            {labels.exportCsv}
          </button>
        </div>

        {loading ? (
          <p className="text-terminal-muted">{labels.loading}</p>
        ) : error ? (
          <p className="text-red-400">{labels.error}</p>
        ) : summary ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
                <p className="text-xs uppercase tracking-wide text-terminal-muted">{labels.accruedTotal}</p>
                <p className="mt-2 text-2xl font-bold text-terminal-text">
                  USD {formatUsd(summary.accruedTotalUsd)}
                </p>
              </article>
              <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
                <p className="text-xs uppercase tracking-wide text-terminal-muted">{labels.paidTotal}</p>
                <p className="mt-2 text-2xl font-bold text-terminal-text">
                  USD {formatUsd(summary.paidTotalUsd)}
                </p>
              </article>
              <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
                <p className="text-xs uppercase tracking-wide text-terminal-muted">{labels.purchaseAccrued}</p>
                <p className="mt-2 text-2xl font-bold text-terminal-text">
                  USD {formatUsd(summary.purchaseAccruedUsd)}
                </p>
              </article>
              <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
                <p className="text-xs uppercase tracking-wide text-terminal-muted">{labels.rentAccrued}</p>
                <p className="mt-2 text-2xl font-bold text-terminal-text">
                  USD {formatUsd(summary.rentAccruedUsd)}
                </p>
              </article>
            </div>

            <section className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                    <tr>
                      <th className="px-6 py-3">{labels.colDate}</th>
                      <th className="px-6 py-3">{labels.colEvent}</th>
                      <th className="px-6 py-3">{labels.colAmount}</th>
                      <th className="px-6 py-3">{labels.colStatus}</th>
                      <th className="px-6 py-3">{labels.colSourceAdvisor}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-terminal-muted">
                          {labels.empty}
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="hover:bg-terminal-bg/60">
                          <td className="px-6 py-4 text-terminal-muted">
                            {formatDateTime(row.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-terminal-text">
                            {eventLabels[row.eventType] ?? row.eventType}
                          </td>
                          <td className="px-6 py-4 font-medium text-terminal-text">
                            USD {formatUsd(row.amountUsd)}
                          </td>
                          <td className="px-6 py-4 text-terminal-muted">
                            {statusLabels[row.status] ?? row.status}
                          </td>
                          <td className="px-6 py-4 text-terminal-muted">
                            {row.sourceAdvisorEmail ?? '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AdvisorGate>
  );
}
