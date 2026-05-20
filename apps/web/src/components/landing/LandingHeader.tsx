'use client';

import Link from 'next/link';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LanguageDropdown } from './LanguageDropdown';

export function LandingHeader() {
  const t = useTranslation();
  const l = t.landing;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
          Sanova <span className="text-blue-600">Global</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="/#how-it-works" className="hover:text-slate-900">
            {l.nav.howItWorks}
          </a>
          <a href="/#properties" className="hover:text-slate-900">
            {l.nav.properties}
          </a>
          <Link href="/marketplace" className="hover:text-slate-900">
            {l.nav.marketplace}
          </Link>
        </nav>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <LanguageDropdown />
          <Link
            href="/acceso"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
          >
            {l.nav.platformAccess}
          </Link>
        </div>
      </div>
    </header>
  );
}
