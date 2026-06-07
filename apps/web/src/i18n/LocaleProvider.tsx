'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultLocale, intlLocaleByCode, messagesByLocale, resolveLocale, rtlLocales, type Locale } from './index';
import { detectBrowserLocales, mapCountryToLocaleHint, resolveInitialLocale } from './detectLocale';
import type { Messages } from './locales/en';

const STORAGE_KEY = 'sanova.locale';
const COUNTRY_COOKIE = 'sanova.country';

function readCountryHint(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function readInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && resolveLocale(stored) !== defaultLocale) {
    return resolveLocale(stored);
  }

  if (stored) {
    return resolveLocale(stored);
  }

  return resolveInitialLocale({
    stored: null,
    countryHint: readCountryHint(),
    browserLanguages: detectBrowserLocales()
  });
}

type LocaleContextValue = {
  locale: Locale;
  intlLocale: string;
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = rtlLocales.includes(locale) ? 'rtl' : 'ltr';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const resolved = readInitialLocale();
    setLocaleState(resolved);
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    }
    applyDocumentLocale(resolved);
    setHydrated(true);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    applyDocumentLocale(nextLocale);

    void fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLocale: nextLocale })
    }).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      intlLocale: intlLocaleByCode[locale],
      messages: messagesByLocale[locale],
      setLocale
    }),
    [locale, setLocale]
  );

  if (!hydrated) {
    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }

  return context;
}

export function useTranslation() {
  const { messages } = useLocale();
  return messages;
}
