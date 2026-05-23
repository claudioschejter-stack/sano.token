'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { AdvisorClientRecord } from '../../lib/advisor/clientsService';
import { AdvisorGate } from './AdvisorGate';

type KycFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
const FILTER_OPTIONS: KycFilter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

function statusBadgeClass(status: string): string {
  if (status === 'APPROVED') {
    return 'border-terminal-success/30 text-terminal-success';
  }
  if (status === 'REJECTED') {
    return 'border-red-500/30 text-red-400';
  }
  return 'border-terminal-warning/30 text-terminal-warning';
}

export function AdvisorClientsView() {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isManager = role === 'ADVISOR_MANAGER';

  const [filter, setFilter] = useState<KycFilter>('ALL');
  const [clients, setClients] = useState<AdvisorClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [suggestEmail, setSuggestEmail] = useState('');
  const [suggestName, setSuggestName] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMessage, setSuggestMessage] = useState<string | null>(null);

  const statusLabels = t.adminInvestors.status as Record<string, string>;
  const filterLabels = t.adminInvestors.filters as Record<KycFilter, string>;

  const loadClients = useCallback(async (nextFilter: KycFilter) => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch(`/api/advisor/clients?status=${nextFilter}`);
      if (!response.ok) {
        throw new Error('Failed to load clients');
      }

      const data = (await response.json()) as { clients: AdvisorClientRecord[] };
      setClients(data.clients);
    } catch {
      setError(true);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients(filter);
  }, [filter, loadClients]);

  async function handleSuggest(event: React.FormEvent) {
    event.preventDefault();
    setSuggesting(true);
    setSuggestMessage(null);

    try {
      const response = await fetch('/api/advisor/nominations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: suggestEmail, name: suggestName || undefined })
      });

      if (!response.ok) {
        throw new Error('suggest failed');
      }

      setSuggestEmail('');
      setSuggestName('');
      setSuggestMessage(t.advisorPortal.suggestSuccess);
    } catch {
      setSuggestMessage(t.advisorPortal.suggestError);
    } finally {
      setSuggesting(false);
    }
  }

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
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
              {t.advisorPortal.navClients}
            </p>
            <span className="rounded-full border border-terminal-border px-2.5 py-0.5 text-xs text-terminal-muted">
              {t.advisorPortal.readOnlyBadge}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text">
            {t.advisorPortal.clientsTitle}
          </h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">
            {isManager ? t.advisorPortal.clientsDescManager : t.advisorPortal.clientsDescAdvisor}
          </p>
        </header>

        {role === 'ADVISOR' ? (
          <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
            <h2 className="text-lg font-semibold text-terminal-text">{t.advisorPortal.suggestTitle}</h2>
            <p className="mt-1 text-sm text-terminal-muted">{t.advisorPortal.suggestDesc}</p>
            <form onSubmit={(event) => void handleSuggest(event)} className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-terminal-muted">{t.adminTeam.email}</span>
                <input
                  type="email"
                  required
                  value={suggestEmail}
                  onChange={(event) => setSuggestEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                />
              </label>
              <label className="block text-sm">
                <span className="text-terminal-muted">{t.adminTeam.name}</span>
                <input
                  type="text"
                  value={suggestName}
                  onChange={(event) => setSuggestName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                />
              </label>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={suggesting}
                  className="rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary disabled:opacity-50"
                >
                  {t.advisorPortal.suggestSubmit}
                </button>
                {suggestMessage ? <p className="text-sm text-terminal-muted">{suggestMessage}</p> : null}
              </div>
            </form>
          </section>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
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
            onClick={() => void loadClients(filter)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t.adminTeam.refresh}
          </button>
        </div>

        <section className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                <tr>
                  <th className="px-6 py-3">{t.adminInvestors.colInvestor}</th>
                  <th className="px-6 py-3">{t.adminInvestors.colEmail}</th>
                  {isManager ? (
                    <th className="px-6 py-3">{t.advisorPortal.colAdvisor}</th>
                  ) : null}
                  <th className="px-6 py-3">{t.adminInvestors.colKyc}</th>
                  <th className="px-6 py-3">{t.adminInvestors.colRegistered}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {loading ? (
                  <tr>
                    <td colSpan={isManager ? 5 : 4} className="px-6 py-10 text-center text-terminal-muted">
                      {t.advisorPortal.loading}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={isManager ? 5 : 4} className="px-6 py-10 text-center text-red-400">
                      {t.advisorPortal.error}
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={isManager ? 5 : 4} className="px-6 py-10 text-center">
                      <p className="text-terminal-muted">{t.advisorPortal.empty}</p>
                      <p className="mt-2 text-xs text-terminal-muted">{t.advisorPortal.emptyHint}</p>
                    </td>
                  </tr>
                ) : (
                  clients.map((row) => {
                    const displayName = row.investor?.fullName ?? row.name ?? '—';
                    return (
                      <tr key={row.id} className="hover:bg-terminal-bg/60">
                        <td className="px-6 py-4 font-medium text-terminal-text">{displayName}</td>
                        <td className="px-6 py-4 text-terminal-muted">{row.email}</td>
                        {isManager ? (
                          <td className="px-6 py-4 text-terminal-muted">
                            {row.incorporatedByEmail ?? '—'}
                          </td>
                        ) : null}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.kycStatus)}`}
                          >
                            {statusLabels[row.kycStatus] ?? row.kycStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-terminal-muted">
                          {formatDateTime(row.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdvisorGate>
  );
}
