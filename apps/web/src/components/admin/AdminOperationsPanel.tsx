'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { PlatformOpsReport } from '../../lib/admin/platformOperationalReadiness';

type RepairResult = {
  dryRun?: boolean;
  targetIds?: string[];
  results?: Array<{ projectId: string; ok: boolean; error?: string }>;
  after?: PlatformOpsReport;
};

export function AdminOperationsPanel() {
  const t = useTranslation();
  const labels = t.adminOperations;

  const [report, setReport] = useState<PlatformOpsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(false);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/operations/readiness', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('load failed');
      }
      const data = (await response.json()) as PlatformOpsReport;
      setReport(data);
    } catch {
      setError(true);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  async function runRepair(dryRun: boolean) {
    setRepairing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/operations/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun })
      });

      const data = (await response.json()) as RepairResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'repair failed');
      }

      if (dryRun) {
        setMessage(
          labels.dryRunResult.replace('{count}', String(data.targetIds?.length ?? 0))
        );
      } else {
        const okCount = data.results?.filter((row) => row.ok).length ?? 0;
        setMessage(labels.repairResult
          .replace('{ok}', String(okCount))
          .replace('{total}', String(data.results?.length ?? 0)));
        await loadReport();
      }
    } catch {
      setMessage(labels.repairError);
    } finally {
      setRepairing(false);
    }
  }

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-terminal-primary">
            {labels.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-bold text-terminal-text">{labels.title}</h2>
          <p className="mt-1 text-sm text-terminal-muted">{labels.desc}</p>
        </div>
        <button
          type="button"
          disabled={loading || repairing}
          onClick={() => void loadReport()}
          className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted transition-colors hover:text-terminal-text disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {labels.refresh}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-400">{labels.error}</p>
      ) : loading && !report ? (
        <p className="mt-4 text-sm text-terminal-muted">{labels.loading}</p>
      ) : report ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
              <p className="text-xs text-terminal-muted">{labels.platformReady}</p>
              <p className="mt-1 text-lg font-semibold text-terminal-text">
                {report.summary.platformReady ? labels.yes : labels.no}
              </p>
            </div>
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
              <p className="text-xs text-terminal-muted">{labels.projectsReady}</p>
              <p className="mt-1 text-lg font-semibold text-terminal-text">
                {report.summary.projectsReady}/{report.summary.projectsTotal}
              </p>
            </div>
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
              <p className="text-xs text-terminal-muted">{labels.projectsNeedingRepair}</p>
              <p className="mt-1 text-lg font-semibold text-terminal-warning">
                {report.summary.projectsNeedingRepair}
              </p>
            </div>
          </div>

          {report.platformChecks.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {report.platformChecks.map((check) => (
                <li
                  key={check.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-terminal-border px-3 py-2"
                >
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                      check.status === 'OK'
                        ? 'border-terminal-success/30 text-terminal-success'
                        : check.status === 'WARN'
                          ? 'border-terminal-warning/30 text-terminal-warning'
                          : 'border-red-500/30 text-red-400'
                    }`}
                  >
                    {check.status}
                  </span>
                  <span className="font-medium text-terminal-text">{check.label}</span>
                  {check.detail ? (
                    <span className="text-terminal-muted">{check.detail}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={repairing}
              onClick={() => void runRepair(true)}
              className="rounded-lg border border-terminal-border px-3 py-2 text-sm font-semibold text-terminal-text disabled:opacity-50"
            >
              {labels.dryRun}
            </button>
            <button
              type="button"
              disabled={repairing || report.summary.projectsNeedingRepair === 0}
              onClick={() => void runRepair(false)}
              className="rounded-lg bg-terminal-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {repairing ? labels.repairing : labels.repairAll}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-terminal-muted">{message}</p> : null}
    </section>
  );
}
