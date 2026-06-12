'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultLocale, intlLocaleByCode, messagesByLocale, resolveLocale, rtlLocales, type Locale } from './index';
import {
  detectBrowserLocales,
  detectDeviceLocale,
  readCountryHint,
  resolveInitialLocale
} from './detectLocale';
import { isMobileDevice } from '../lib/mobile/deviceConfig';
import {
  LOCALE_STORAGE_KEY,
  pinMobileLocale,
  readPinnedMobileLocale
} from '../lib/i18n/mobileLocalePreference';
import type { Messages } from './locales/en';

const STORAGE_KEY = LOCALE_STORAGE_KEY;

function readInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  if (isMobileDevice()) {
    const pinned = readPinnedMobileLocale();
    if (pinned) {
      return pinned;
    }

    return detectDeviceLocale();
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
    const cookieLocale = document.cookie.match(/(?:^|; )sanova\.locale=([^;]*)/)?.[1];
    const decodedCookie = cookieLocale ? decodeURIComponent(cookieLocale) : null;
    if (decodedCookie && !window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.setItem(STORAGE_KEY, resolveLocale(decodedCookie));
    }

    const resolved = readInitialLocale();
    setLocaleState(resolved);
    if (isMobileDevice() || !window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    }
    applyDocumentLocale(resolved);
    setHydrated(true);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    if (isMobileDevice()) {
      pinMobileLocale(nextLocale);
    } else {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    }
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
