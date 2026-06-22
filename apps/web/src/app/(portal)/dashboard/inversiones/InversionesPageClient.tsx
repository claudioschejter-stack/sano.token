'use client';

import { InvestorPageHeader } from '../../../../components/dashboard/investor/InvestorPageHeader';
import { PrivyEarnVaultsPanel } from '../../../../components/privy/PrivyEarnVaultsPanel';
import { useTranslation } from '../../../../i18n/LocaleProvider';

export function InversionesPageClient() {
  const t = useTranslation();

  return (
    <section className="mx-auto max-w-7xl space-y-8 bg-terminal-bg text-terminal-text md:space-y-10">
      <InvestorPageHeader
        eyebrow={t.nav.investments}
        title={t.investments.title}
        subtitle={t.investments.subtitle}
      />
      <PrivyEarnVaultsPanel />
    </section>
  );
}
