'use client';

import Link from 'next/link';
import { Building } from 'lucide-react';
import { InvestorPortfolioPanel } from '../../../../components/dashboard/investor/InvestorPortfolioPanel';
import { InvestorPageHeader } from '../../../../components/dashboard/investor/InvestorPageHeader';
import { PrivyEarnVaultsPanel } from '../../../../components/privy/PrivyEarnVaultsPanel';
import { PlatformWalletView } from '../../../../components/wallet/PlatformWalletView';
import { useTranslation } from '../../../../i18n/LocaleProvider';

export function PortfolioPageClient() {
  const t = useTranslation();
  const p = t.portfolio;

  return (
    <section className="mx-auto max-w-7xl space-y-8 bg-terminal-bg text-terminal-text md:space-y-10">
      <InvestorPageHeader eyebrow={t.nav.myAssets} title={p.title} subtitle={p.subtitle} />

      <InvestorPortfolioPanel />

      <PrivyEarnVaultsPanel />

      <div className="border-t border-terminal-border pt-8 md:pt-10">
        <PlatformWalletView hideHeader />
      </div>

      <Link
        href="/marketplace"
        className="inline-flex items-center gap-2 text-sm font-medium text-terminal-primary hover:text-blue-400"
      >
        <Building size={16} />
        {t.landing.cta.button}
      </Link>
    </section>
  );
}
