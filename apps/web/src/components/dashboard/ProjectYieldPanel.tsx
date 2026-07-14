'use client';

import { ExternalLink, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { Messages } from '../../i18n/locales/en';
import type { ProjectYieldRow, ProjectYieldSummary } from '../../lib/investor/projectYieldService';
import { InvestorSection } from './investor/InvestorSection';

type ProjectYieldPanelProps = {
  compact?: boolean;
};

type ProjectYieldCardProps = {
  project: ProjectYieldRow;
  compact: boolean;
  labels: Messages['projectYield'];
  formatUsd: (value: number) => string;
  formatDate: (value: string) => string;
  formatPercent: (value: number) => string;
};

function ProjectYieldCard({
  project,
  compact,
  labels,
  formatUsd,
  formatDate,
  formatPercent
}: ProjectYieldCardProps) {
  return (
    <article className="rounded-xl border border-terminal-border bg-terminal-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-terminal-primary" />
            <h3 className="font-semibold text-terminal-text">{project.projectTitle}</h3>
          </div>
          {project.tokenSymbol ? <p className="mt-1 text-xs text-terminal-muted">{project.tokenSymbol}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-xs text-terminal-muted">{labels.targetApy}</p>
          <p className="font-mono text-sm font-bold text-terminal-success">
            {formatPercent(project.targetYieldPercent)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-terminal-muted">{labels.invested}</p>
          <p className="font-mono font-semibold">{formatUsd(project.investedUsd)}</p>
        </div>
        <div>
          <p className="text-xs text-terminal-muted">{labels.received}</p>
          <p className="font-mono font-semibold text-terminal-accent">{formatUsd(project.totalReceivedUsd)}</p>
        </div>
        <div>
          <p className="text-xs text-terminal-muted">{labels.realizedYield}</p>
          <p className="font-mono font-semibold">
            {project.realizedYieldPercent != null ? formatPercent(project.realizedYieldPercent) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-terminal-muted">{labels.lastPayment}</p>
          <p className="text-xs text-terminal-text">
            {project.lastDistributionAt ? formatDate(project.lastDistributionAt) : '—'}
          </p>
        </div>
      </div>

      {!compact && project.recentDistributions.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-terminal-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wider text-terminal-muted">{labels.recentPayments}</p>
          {project.recentDistributions.map((distribution) => (
            <div
              key={distribution.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-terminal-border/60 px-3 py-2 text-xs"
            >
              <div>
                <p className="text-terminal-text">{distribution.concept}</p>
                <p className="text-terminal-muted">{formatDate(distribution.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-mono font-semibold text-terminal-accent">
                  {formatUsd(Number(distribution.amountUsd))}
                </p>
                {distribution.txHash ? (
                  <a
                    href={`https://basescan.org/tx/${distribution.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-terminal-primary hover:underline"
                    aria-label={labels.viewTx}
                  >
                    <ExternalLink size={12} />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function ProjectYieldPanel({ compact = false }: ProjectYieldPanelProps) {
  const t = useTranslation();
  const y = t.projectYield;
  const { intlLocale } = useLocale();
  const { formatUsd, formatDate, formatPercent } = createIntlFormatters(intlLocale);
  const [summary, setSummary] = useState<ProjectYieldSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/portfolio/yield-by-project', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: ProjectYieldSummary & { ok?: boolean }) => {
        if (cancelled) {
          return;
        }
        setSummary({
          projects: data.projects ?? [],
          totals: data.totals ?? {
            investedUsd: 0,
            totalReceivedUsd: 0,
            weightedTargetYieldPercent: null,
            portfolioRealizedYieldPercent: null,
            platformAverageTargetYieldPercent: null
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <InvestorSection title={y.title} subtitle={y.subtitle}>
        <p className="text-sm text-terminal-muted">{t.common.loadingGeneric}</p>
      </InvestorSection>
    );
  }

  if (!summary || summary.projects.length === 0) {
    return (
      <InvestorSection title={y.title} subtitle={y.subtitle}>
        <p className="text-sm text-terminal-muted">{y.empty}</p>
      </InvestorSection>
    );
  }

  return (
    <InvestorSection title={y.title} subtitle={y.subtitle}>
      {!compact && summary.totals.weightedTargetYieldPercent != null ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
            <p className="text-xs text-terminal-muted">{y.totalReceived}</p>
            <p className="mt-1 font-mono text-lg font-bold text-terminal-accent">
              {formatUsd(summary.totals.totalReceivedUsd)}
            </p>
          </div>
          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
            <p className="text-xs text-terminal-muted">{y.weightedTarget}</p>
            <p className="mt-1 font-mono text-lg font-bold text-terminal-success">
              {formatPercent(summary.totals.weightedTargetYieldPercent)}
            </p>
          </div>
          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
            <p className="text-xs text-terminal-muted">{y.realizedYield}</p>
            <p className="mt-1 font-mono text-lg font-bold text-terminal-text">
              {summary.totals.portfolioRealizedYieldPercent != null
                ? formatPercent(summary.totals.portfolioRealizedYieldPercent)
                : '—'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {summary.projects.map((project) => (
          <ProjectYieldCard
            key={project.projectId}
            project={project}
            compact={compact}
            labels={y}
            formatUsd={formatUsd}
            formatDate={formatDate}
            formatPercent={formatPercent}
          />
        ))}
      </div>
    </InvestorSection>
  );
}
