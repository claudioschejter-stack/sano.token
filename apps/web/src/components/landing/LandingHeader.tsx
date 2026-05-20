'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LanguageDropdown } from './LanguageDropdown';

const navLinkClass =
  'block w-full rounded-lg px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 lg:inline-block lg:w-auto lg:rounded-none lg:px-0 lg:py-0 lg:text-sm';

const platformCtaClass =
  'inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 md:w-auto lg:min-h-0 lg:py-2';

export function LandingHeader() {
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
    { href: '/marketplace', label: l.nav.marketplace }
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-slate-900 md:text-xl"
          onClick={closeMenu}
        >
          Sanova <span className="text-blue-600">Global</span>
        </Link>

        <nav
          className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex"
          aria-label="Principal"
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

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageDropdown />
          <Link href="/acceso" className={platformCtaClass}>
            {l.nav.platformAccess}
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-800 transition hover:bg-slate-50 lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-nav"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
      </div>

      <div
        id="landing-mobile-nav"
        className={`fixed inset-0 z-[60] lg:hidden ${menuOpen ? 'visible' : 'invisible pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          aria-label="Cerrar menú"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMenu}
        />

        <nav
          className={`absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          aria-label="Menú móvil"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
            <span className="text-sm font-semibold text-slate-900">Menú</span>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Cerrar menú"
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
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-6">
            <LanguageDropdown className="w-full" />
            <Link href="/acceso" className={platformCtaClass} onClick={closeMenu}>
              {l.nav.platformAccess}
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
