'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { BorrowPanel } from '../marketplace/BorrowPanel';
import { BorrowRatesTable } from '../marketplace/BorrowRatesTable';
import type { BestBorrowRateResponse } from '../../types/marketplace';

export type BorrowReadyProject = {
  id: string;
  vaultAddress: string;
  title: string;
};

type AdminLoansBorrowSectionProps = {
  borrowReadyProjects?: BorrowReadyProject[];
};

export function AdminLoansBorrowSection({ borrowReadyProjects = [] }: AdminLoansBorrowSectionProps) {
  const t = useTranslation();
  const [borrowRate, setBorrowRate] = useState<BestBorrowRateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => borrowReadyProjects.find((project) => project.id === selectedProjectId) ?? null,
    [borrowReadyProjects, selectedProjectId]
  );

  useEffect(() => {
    setSelectedProjectId(borrowReadyProjects[0]?.id ?? null);
  }, [borrowReadyProjects]);

  useEffect(() => {
    setLoading(true);
    void fetch('/api/marketplace/feed', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { borrowRate?: BestBorrowRateResponse | null }) => {
        setBorrowRate(data.borrowRate ?? null);
      })
      .catch(() => setBorrowRate(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-terminal-muted">{t.adminLoans.loadingRates}</p>;
  }

  if (!borrowRate) {
    return (
      <p className="rounded-lg border border-terminal-warning/30 bg-terminal-warning/10 px-4 py-3 text-sm text-terminal-warning">
        {t.adminLoans.noBorrowRates}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-terminal-primary">
          {t.adminLoans.borrowRequestTitle}
        </p>
        <h2 className="mt-1 text-lg font-bold text-terminal-text">{t.adminLoans.borrowRequestSubtitle}</h2>

        {borrowReadyProjects.length === 0 ? (
          <p className="mt-3 text-sm text-terminal-muted">{t.adminLoans.noBorrowReadyProjects}</p>
        ) : borrowReadyProjects.length === 1 ? (
          <p className="mt-3 text-sm text-terminal-muted">
            {t.adminLoans.selectedBorrowProject}:{' '}
            <span className="font-medium text-terminal-text">{borrowReadyProjects[0].title}</span>
          </p>
        ) : (
          <label className="mt-3 block text-sm">
            <span className="text-terminal-muted">{t.adminLoans.selectBorrowProject}</span>
            <select
              value={selectedProjectId ?? ''}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="mt-1.5 w-full max-w-xl rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text outline-none focus:border-terminal-primary"
            >
              {borrowReadyProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-3 text-xs text-terminal-muted">{t.adminLoans.adminBorrowWalletHint}</p>
      </section>

      <BorrowRatesTable borrowRate={borrowRate} />
      {borrowReadyProjects.length > 0 ? (
        <BorrowPanel
          borrowRate={borrowRate}
          projectId={selectedProject?.id}
          vaultAddress={selectedProject?.vaultAddress}
          readyToBorrow={Boolean(selectedProject)}
        />
      ) : null}
    </div>
  );
}
