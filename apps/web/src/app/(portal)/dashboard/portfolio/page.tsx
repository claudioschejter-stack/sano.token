'use client';

import Link from 'next/link';
import { Building } from 'lucide-react';
import { InvestorPortfolioPanel } from '../../../../components/dashboard/investor/InvestorPortfolioPanel';
import { InvestorPageHeader } from '../../../../components/dashboard/investor/InvestorPageHeader';
import { useTranslation } from '../../../../i18n/LocaleProvider';

export default function PortfolioPage() {
  const t = useTranslation();
  const p = t.portfolio;

  return (
    <section className="mx-auto max-w-6xl space-y-6 bg-terminal-bg text-terminal-text md:space-y-8">
      <InvestorPageHeader eyebrow={t.nav.myAssets} title={p.title} subtitle={p.subtitle} />

      <InvestorPortfolioPanel />

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
