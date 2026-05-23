'use client';

import Link from 'next/link';
import { Building, TrendingUp } from 'lucide-react';
import { useEffect } from 'react';
import { KycIdentityDetails } from '../../../../components/identity/KycIdentityDetails';
import { useAccountStatus } from '../../../../hooks/useAccountStatus';
import { createIntlFormatters } from '../../../../i18n/formatters';
import { useLocale, useTranslation } from '../../../../i18n/LocaleProvider';
import { usePortfolioStore } from '../../../../store/usePortfolioStore';

export default function PortfolioPage() {
  const t = useTranslation();
  const p = t.portfolio;
  const identityLabels = t.identityProfile;
  const { intlLocale } = useLocale();
  const { formatUsd, formatDate } = createIntlFormatters(intlLocale);
  const { profile, loading: profileLoading } = useAccountStatus();
  const fetchPortfolio = usePortfolioStore((state) => state.fetchPortfolio);
  const isLoading = usePortfolioStore((state) => state.isLoading);
  const activePositions = usePortfolioStore((state) => state.activePositions);
  const capital = usePortfolioStore((state) => state.capital);
  const marginDebt = usePortfolioStore((state) => state.marginDebt);
  const ltv = usePortfolioStore((state) => state.ltv);

  useEffect(() => {
    void fetchPortfolio();
  }, [fetchPortfolio]);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="border-b border-terminal-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">{t.nav.myAssets}</p>
        <h1 className="mt-2 text-3xl font-bold text-terminal-text">{p.title}</h1>
        <p className="mt-3 text-terminal-muted">{p.subtitle}</p>
      </header>

      {!profileLoading && profile ? (
        <KycIdentityDetails
          identity={profile.identity}
          labels={identityLabels}
          className="border-terminal-border bg-terminal-card text-terminal-text"
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
          <p className="text-xs uppercase tracking-wider text-terminal-muted">Capital</p>
          <p className="mt-2 font-mono text-2xl font-bold text-terminal-text">{formatUsd(capital)}</p>
        </article>
        <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
          <p className="text-xs uppercase tracking-wider text-terminal-muted">Deuda margen</p>
          <p className="mt-2 font-mono text-2xl font-bold text-terminal-text">{formatUsd(marginDebt)}</p>
        </article>
        <article className="rounded-xl border border-terminal-border bg-terminal-card p-5">
          <p className="text-xs uppercase tracking-wider text-terminal-muted">LTV</p>
          <p className="mt-2 font-mono text-2xl font-bold text-terminal-text">{ltv.toFixed(2)}%</p>
        </article>
      </div>

      {isLoading ? (
        <p className="text-terminal-muted">{t.marketplace.syncing}</p>
      ) : activePositions.length === 0 ? (
        <article className="rounded-xl border border-terminal-border bg-terminal-card p-8">
          <div className="mb-4 inline-flex rounded-lg border border-terminal-border bg-terminal-bg p-3 text-terminal-primary">
            <Building size={24} />
          </div>
          <p className="text-terminal-muted">{p.empty ?? p.comingSoon}</p>
          <Link
            href="/marketplace"
            className="mt-6 inline-flex rounded-lg bg-terminal-primary px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {t.landing.cta.button}
          </Link>
        </article>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-terminal-border bg-terminal-card">
          <table className="min-w-full text-sm">
            <thead className="border-b border-terminal-border bg-terminal-bg/60 text-left text-xs uppercase tracking-wider text-terminal-muted">
              <tr>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3">Tokens</th>
                <th className="px-4 py-3">Invertido</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {activePositions.map((position) => (
                <tr key={position.id} className="border-b border-terminal-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium text-terminal-text">{position.projectTitle}</td>
                  <td className="px-4 py-3 font-mono">{position.tokenCount.toLocaleString(intlLocale)}</td>
                  <td className="px-4 py-3 font-mono">{formatUsd(Number(position.purchasePriceUsd))}</td>
                  <td className="px-4 py-3 text-terminal-muted">{formatDate(position.purchasedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activePositions.length > 0 ? (
        <Link
          href="/dashboard/cash-flow"
          className="inline-flex items-center gap-2 text-sm font-medium text-terminal-primary hover:text-blue-400"
        >
          <TrendingUp size={16} />
          {t.nav.cashFlow}
        </Link>
      ) : null}
    </section>
  );
}
