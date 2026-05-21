'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultLocale, intlLocaleByCode, messagesByLocale, resolveLocale, rtlLocales, type Locale } from './index';
import type { Messages } from './locales/en';

const STORAGE_KEY = 'sanova.locale';

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  return resolveLocale(window.localStorage.getItem(STORAGE_KEY));
}

type LocaleContextValue = {
  locale: Locale;
  intlLocale: string;
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const resolved = readStoredLocale();
    setLocaleState(resolved);
    document.documentElement.lang = resolved;
    document.documentElement.dir = rtlLocales.includes(resolved) ? 'rtl' : 'ltr';
    setHydrated(true);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = rtlLocales.includes(nextLocale) ? 'rtl' : 'ltr';
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
