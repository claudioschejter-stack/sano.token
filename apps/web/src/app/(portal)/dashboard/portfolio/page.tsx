'use client';

import Link from 'next/link';
import { Building, CheckCircle2, ExternalLink, TrendingUp } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { KycIdentityDetails } from '../../../../components/identity/KycIdentityDetails';
import { DashboardSkeleton } from '../../../../components/dashboard/DashboardSkeleton';
import { InvestorKpiCard } from '../../../../components/dashboard/investor/InvestorKpiCard';
import { InvestorPageHeader } from '../../../../components/dashboard/investor/InvestorPageHeader';
import { useAccountStatus } from '../../../../hooks/useAccountStatus';
import { createIntlFormatters } from '../../../../i18n/formatters';
import { useLocale, useTranslation } from '../../../../i18n/LocaleProvider';
import { usePortfolioStore, type PortfolioPosition } from '../../../../store/usePortfolioStore';

function OnChainBadge({
  position,
  verifiedLabel,
  pendingLabel
}: {
  position: PortfolioPosition;
  verifiedLabel: string;
  pendingLabel: string;
}) {
  if (position.onChain?.verified && Number(position.onChain.assetsUsd) > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-terminal-success/30 bg-terminal-success/10 px-2 py-0.5 text-xs font-semibold text-terminal-success">
        <CheckCircle2 size={12} />
        {verifiedLabel}
      </span>
    );
  }

  if (position.vaultAddress) {
    return (
      <span className="inline-flex rounded-full border border-terminal-border px-2 py-0.5 text-xs text-terminal-muted">
        {pendingLabel}
      </span>
    );
  }

  return null;
}

function PositionLinks({
  position,
  viewVaultLabel,
  viewPurchaseLabel
}: {
  position: PortfolioPosition;
  viewVaultLabel: string;
  viewPurchaseLabel: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-xs">
      {position.onChain?.explorerUrl ? (
        <a
          href={position.onChain.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-terminal-primary hover:underline"
        >
          {viewVaultLabel}
          <ExternalLink size={12} />
        </a>
      ) : null}
      {position.onChain?.txExplorerUrl ? (
        <a
          href={position.onChain.txExplorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-terminal-primary hover:underline"
        >
          {viewPurchaseLabel}
          <ExternalLink size={12} />
        </a>
      ) : null}
    </div>
  );
}

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

  const displayCapital = useMemo(() => {
    if (activePositions.length === 0) {
      return capital;
    }

    return activePositions.reduce(
      (sum, position) => sum + Number(position.currentValueUsd ?? position.purchasePriceUsd),
      0
    );
  }, [activePositions, capital]);

  return (
    <section className="mx-auto max-w-5xl space-y-6 bg-terminal-bg text-terminal-text md:space-y-8">
      <InvestorPageHeader eyebrow={t.nav.myAssets} title={p.title} subtitle={p.subtitle} />

      {!profileLoading && profile ? (
        <KycIdentityDetails
          identity={profile.identity}
          labels={identityLabels}
          className="border-terminal-border bg-terminal-card text-terminal-text"
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <InvestorKpiCard
          label={p.kpiCapital}
          value={formatUsd(displayCapital)}
          hint={p.subtitle}
          icon={<Building size={22} />}
          valueClassName="text-terminal-text"
        />
        <InvestorKpiCard
          label={p.kpiMarginDebt}
          value={formatUsd(marginDebt)}
          hint={p.kpiMarginDebtHint}
          icon={<TrendingUp size={22} />}
          valueClassName="text-terminal-warning"
          iconClassName="bg-terminal-bg text-terminal-warning"
        />
        <InvestorKpiCard
          label={p.kpiLtv}
          value={`${ltv.toFixed(2)}%`}
          hint={p.kpiLtvHint}
          icon={<TrendingUp size={22} />}
          valueClassName={ltv > 70 ? 'text-terminal-warning' : 'text-terminal-success'}
          iconClassName={ltv > 70 ? 'bg-terminal-bg text-terminal-warning' : 'bg-terminal-bg text-terminal-success'}
        />
      </div>

      {isLoading ? (
        <DashboardSkeleton />
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
        <>
          <div className="space-y-3 md:hidden">
            {activePositions.map((position) => (
              <article key={position.id} className="rounded-xl border border-terminal-border bg-terminal-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-terminal-text">{position.projectTitle}</p>
                  <OnChainBadge
                    position={position}
                    verifiedLabel={p.onChainVerified}
                    pendingLabel={p.onChainPending}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-terminal-muted">{p.colTokens}</p>
                    <p className="font-mono font-semibold">{position.tokenCount.toLocaleString(intlLocale)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-terminal-muted">{p.colCurrentValue}</p>
                    <p className="font-mono font-semibold">
                      {formatUsd(Number(position.currentValueUsd ?? position.purchasePriceUsd))}
                    </p>
                  </div>
                  {position.onChain?.shares ? (
                    <div className="col-span-2">
                      <p className="text-xs text-terminal-muted">{p.colVaultShares}</p>
                      <p className="font-mono text-sm">{BigInt(position.onChain.shares).toLocaleString(intlLocale)}</p>
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-terminal-muted">
                  {p.colDate}: {formatDate(position.purchasedAt)}
                </p>
                <PositionLinks
                  position={position}
                  viewVaultLabel={p.viewVault}
                  viewPurchaseLabel={p.viewPurchaseTx}
                />
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-terminal-border bg-terminal-card md:block">
            <table className="min-w-full text-sm">
              <thead className="border-b border-terminal-border bg-terminal-bg/60 text-left text-xs uppercase tracking-wider text-terminal-muted">
                <tr>
                  <th className="px-4 py-3">{p.colAsset}</th>
                  <th className="px-4 py-3">{p.colTokens}</th>
                  <th className="px-4 py-3">{p.colVaultShares}</th>
                  <th className="px-4 py-3">{p.colCurrentValue}</th>
                  <th className="px-4 py-3">{p.colDate}</th>
                  <th className="px-4 py-3">On-chain</th>
                </tr>
              </thead>
              <tbody>
                {activePositions.map((position) => (
                  <tr key={position.id} className="border-b border-terminal-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-terminal-text">{position.projectTitle}</td>
                    <td className="px-4 py-3 font-mono">{position.tokenCount.toLocaleString(intlLocale)}</td>
                    <td className="px-4 py-3 font-mono text-terminal-muted">
                      {position.onChain?.shares
                        ? BigInt(position.onChain.shares).toLocaleString(intlLocale)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatUsd(Number(position.currentValueUsd ?? position.purchasePriceUsd))}
                    </td>
                    <td className="px-4 py-3 text-terminal-muted">{formatDate(position.purchasedAt)}</td>
                    <td className="px-4 py-3">
                      <OnChainBadge
                    position={position}
                    verifiedLabel={p.onChainVerified}
                    pendingLabel={p.onChainPending}
                  />
                      <PositionLinks
                  position={position}
                  viewVaultLabel={p.viewVault}
                  viewPurchaseLabel={p.viewPurchaseTx}
                />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
