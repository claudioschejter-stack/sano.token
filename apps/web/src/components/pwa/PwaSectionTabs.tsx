'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useLoansPreference } from '../../hooks/useLoansPreference';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type SectionTab = {
  href: string;
  label: string;
};

function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PwaSectionTabs() {
  const pathname = usePathname();
  const t = useTranslation();
  const { loansEnabled } = useLoansPreference();

  const tabs: SectionTab[] = [
    { href: '/dashboard', label: t.nav.globalPosition },
    { href: '/marketplace', label: t.nav.marketplace },
    { href: '/mercado-secundario', label: t.nav.secondaryMarket },
    { href: '/dashboard/portfolio', label: t.nav.myAssets },
    { href: '/dashboard/legal', label: t.nav.legal },
    ...(loansEnabled ? [{ href: '/dashboard/loans', label: t.nav.loans }] : [])
  ];

  return (
    <nav
      aria-label={t.pwaHome.sectionTabsAria}
      className="hide-scrollbar -mx-4 flex gap-5 overflow-x-auto border-b border-slate-100 bg-white px-4"
    >
      {tabs.map((tab) => {
        const active = isTabActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 whitespace-nowrap py-3 text-sm font-semibold transition-colors ${
              active ? '' : 'text-slate-400'
            }`}
            style={active ? { color: MP_ACCENT, borderBottom: `2px solid ${MP_ACCENT}` } : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
