'use client';

import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { SanovaLogo } from '../brand/SanovaLogo';
import { LanguageDropdown, LanguageMobileAccordion } from './LanguageDropdown';
import { platformEntryCtaClassName } from './MarketplaceCtaLink';

const navLinkClass =
  'block w-full rounded-lg px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 lg:inline-block lg:w-auto lg:rounded-none lg:px-0 lg:py-0 lg:text-sm';

const headerSignUpClass =
  'inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 sm:min-h-10 sm:px-4 sm:text-sm';

const headerSignUpMobileClass =
  'inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-transparent px-3 text-xs font-semibold text-blue-600 transition hover:bg-blue-500/10 sm:min-h-10 sm:px-4 sm:text-sm';

const headerSignInMobileClass =
  'inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-blue-500 px-3 text-xs font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400 sm:min-h-10 sm:px-4 sm:text-sm';

type LandingHeaderProps = {
  /** Language selector is shown only on the main landing page. */
  showLanguageSelector?: boolean;
};

export function LandingHeader({ showLanguageSelector = false }: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useTranslation();
  const l = t.landing;

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const navItems = [
    { href: '/#how-it-works', label: l.nav.howItWorks },
    { href: '/#properties', label: l.nav.properties },
    { href: '/acceso?returnTo=/marketplace', label: l.nav.marketplace },
    { href: '/acceso?returnTo=/mercado-secundario', label: l.nav.secondaryMarket }
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3 md:gap-3 md:px-6 md:py-4">
        <SanovaLogo
          variant="light"
          href="/"
          className="min-w-0 shrink"
          priority={showLanguageSelector}
          onClick={closeMenu}
        />

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

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 lg:hidden">
            <Link href="/acceso/registro" className={headerSignUpMobileClass} onClick={closeMenu}>
              {l.nav.signUp}
            </Link>
            <Link href="/acceso" className={headerSignInMobileClass} onClick={closeMenu}>
              {l.nav.signIn}
            </Link>
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

          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-800 transition hover:bg-slate-50 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            aria-label={menuOpen ? l.nav.closeMenu : l.nav.openMenu}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </div>

      <div
        id="landing-mobile-nav"
        className={`fixed inset-0 z-[60] lg:hidden ${menuOpen ? 'visible' : 'invisible pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          aria-label={l.nav.closeMenu}
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMenu}
        />

        <nav
          className={`absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          aria-label={l.nav.mobileNavAria}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
            <span className="text-sm font-semibold text-slate-900">{l.nav.menuLabel}</span>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label={l.nav.closeMenu}
              onClick={closeMenu}
            >
              <X size={22} aria-hidden />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-6">
            {navItems.map((item) =>
              item.href.startsWith('/#') ? (
                <a key={item.href} href={item.href} className={navLinkClass} onClick={closeMenu}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.href} href={item.href} className={navLinkClass} onClick={closeMenu}>
                  {item.label}
                </Link>
              )
            )}
            <Link href="/contacto" className={navLinkClass} onClick={closeMenu}>
              {l.footer.contact}
            </Link>
            {showLanguageSelector ? (
              <LanguageMobileAccordion className="mt-1" menuOpen={menuOpen} />
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-6">
            <Link href="/acceso/registro" className={headerSignUpClass} onClick={closeMenu}>
              {l.nav.signUp}
            </Link>
            <Link href="/acceso" className={platformEntryCtaClassName} onClick={closeMenu}>
              {l.nav.signIn}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
