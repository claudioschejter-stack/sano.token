'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { DownlineAdvisorRecord } from '../../lib/advisor/downlineService';
import { AdvisorGate } from './AdvisorGate';

export function AdvisorTeamView() {
  const t = useTranslation();
  const labels = t.advisorPortal.team;
  const { intlLocale } = useLocale();
  const { formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [advisors, setAdvisors] = useState<DownlineAdvisorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch('/api/advisor/downline');
      if (!response.ok) {
        throw new Error('Failed');
      }
      const data = (await response.json()) as { advisors: DownlineAdvisorRecord[] };
      setAdvisors(data.advisors);
    } catch {
      setError(true);
      setAdvisors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {labels.refresh}
        </button>

        <section className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                <tr>
                  <th className="px-6 py-3">{labels.colEmail}</th>
                  <th className="px-6 py-3">{labels.colName}</th>
                  <th className="px-6 py-3">{labels.colCategory}</th>
                  <th className="px-6 py-3">{labels.colUpline}</th>
                  <th className="px-6 py-3">{labels.colClients}</th>
                  <th className="px-6 py-3">{labels.colDownline}</th>
                  <th className="px-6 py-3">{labels.colJoined}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-terminal-muted">
                      {labels.loading}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-red-400">
                      {labels.error}
                    </td>
                  </tr>
                ) : advisors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-terminal-muted">
                      {labels.empty}
                    </td>
                  </tr>
                ) : (
                  advisors.map((row) => (
                    <tr key={row.advisorId} className="hover:bg-terminal-bg/60">
                      <td className="px-6 py-4 text-terminal-muted">{row.email}</td>
                      <td className="px-6 py-4 font-medium text-terminal-text">{row.name ?? '—'}</td>
                      <td className="px-6 py-4 text-terminal-muted">{row.category}</td>
                      <td className="px-6 py-4 text-terminal-muted">{row.uplineEmail ?? '—'}</td>
                      <td className="px-6 py-4 text-terminal-muted">{row.clientCount}</td>
                      <td className="px-6 py-4 text-terminal-muted">{row.downlineCount}</td>
                      <td className="px-6 py-4 text-terminal-muted">
                        {formatDateTime(row.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdvisorGate>
  );
}
