'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { locales, type Locale } from '../../i18n';
import { useTheme, type ThemeMode } from '../providers/ThemeProvider';

export function SessionPreferencesSync() {
  const { status } = useSession();
  const { setLocale } = useLocale();
  const { setTheme } = useTheme();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || loadedRef.current) {
      return;
    }

    loadedRef.current = true;

    void fetch('/api/user/preferences', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { preferredLocale?: string | null; preferredTheme?: string | null } | null) => {
        if (!data) {
          return;
        }

        if (data.preferredLocale && locales.includes(data.preferredLocale as Locale)) {
          setLocale(data.preferredLocale as Locale);
        }

        if (data.preferredTheme === 'light' || data.preferredTheme === 'dark') {
          setTheme(data.preferredTheme as ThemeMode);
        }
      })
      .catch(() => undefined);
  }, [setLocale, setTheme, status]);

  return null;
}
