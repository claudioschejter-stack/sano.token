'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { SanovaLogo } from '../brand/SanovaLogo';
import { LanguageDropdown } from './LanguageDropdown';
import { MobileAuthEntryLink } from '../pwa/MobileAuthEntryLink';
import { platformEntryCtaClassName } from './MarketplaceCtaLink';

const headerSignUpClass =
  'inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 sm:min-h-10 sm:px-4 sm:text-sm';

const headerSignUpMobileClass =
  'inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-transparent px-3 text-xs font-semibold text-blue-600 transition hover:bg-blue-500/10 sm:min-h-10 sm:px-4 sm:text-sm';

const headerSignInMobileClass =
  'inline-flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-full bg-blue-500 px-3 text-xs font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400 sm:min-h-10 sm:px-4 sm:text-sm';

type LandingHeaderProps = {
  /** Language selector is shown only on the main landing page. */
  showLanguageSelector?: boolean;
};

export function LandingHeader({ showLanguageSelector = false }: LandingHeaderProps) {
  const t = useTranslation();
  const l = t.landing;

  const navItems = [
    { href: '/#how-it-works', label: l.nav.howItWorks },
    { href: '/#properties', label: l.nav.properties },
    { href: '/acceso?returnTo=/marketplace', label: l.nav.marketplace },
    { href: '/acceso?returnTo=/mercado-secundario', label: l.nav.secondaryMarket }
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3 md:gap-3 md:px-6 md:py-4">
        <SanovaLogo variant="light" href="/" className="min-w-0 shrink" priority={showLanguageSelector} />

        <nav
          className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex"
          aria-label={l.nav.mainNavAria}
        >
          {navItems.map((item) =>
            item.href.startsWith('/#') ? (
              <a key={item.href} href={item.href} className="hover:text-slate-900">
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className="hover:text-slate-900">
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:flex-none lg:shrink-0">
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:hidden">
            <MobileAuthEntryLink href="/acceso/registro" className={headerSignUpMobileClass}>
              {l.nav.signUp}
            </MobileAuthEntryLink>
            <MobileAuthEntryLink href="/acceso" className={headerSignInMobileClass}>
              {l.nav.signIn}
            </MobileAuthEntryLink>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            {showLanguageSelector ? <LanguageDropdown /> : null}
            <Link href="/acceso/registro" className={headerSignUpClass}>
              {l.nav.signUp}
            </Link>
            <Link href="/acceso" className={platformEntryCtaClassName}>
              {l.nav.signIn}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
