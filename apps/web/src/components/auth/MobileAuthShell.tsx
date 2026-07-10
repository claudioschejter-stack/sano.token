'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Globe } from 'lucide-react';
import { localeOptions, type Locale } from '../../i18n';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

function MobileLanguageSwitch() {
  const { locale, setLocale } = useLocale();
  const t = useTranslation();

  return (
    <label className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-slate-600">
      <Globe size={14} aria-hidden />
      <span className="sr-only">{t.landing.languageSelectAria}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale, { manual: true })}
        aria-label={t.landing.languageSelectAria}
        className="cursor-pointer bg-transparent text-xs font-semibold text-slate-700 outline-none"
      >
        {localeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.flag} {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MobileAuthShell({ children, title, subtitle }: Props) {
  const t = useTranslation();

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <header className="px-6 pb-2 pt-safe-top pt-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white"
              style={{ backgroundColor: MP_ACCENT }}
            >
              S
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sanova Capital</p>
              <p className="text-base font-bold text-slate-900">{t.access.mobileAppBadge}</p>
            </div>
          </div>
          <MobileLanguageSwitch />
        </div>
        {title ? (
          <div className="mt-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
        ) : null}
      </header>

      <main className="px-6 pb-10 pt-4">{children}</main>

      <footer className="px-6 pb-8 text-center text-xs text-slate-400">
        <Link href="/terminos" className="font-medium" style={{ color: MP_ACCENT }}>
          {t.legal.portalFooterTerms}
        </Link>
        {' · '}
        <Link href="/privacidad" className="font-medium" style={{ color: MP_ACCENT }}>
          {t.legal.portalFooterPrivacy}
        </Link>
      </footer>
    </div>
  );
}
