'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { detectBrowserLocales, readCountryHint, resolveInitialLocale } from '../../i18n/detectLocale';
import { normalizePaymentCountry } from '../../lib/payments/paymentCountry';
import { readLocaleManualFlag, setLocaleManualFlag } from '../../lib/i18n/mobileLocalePreference';
import { useTheme, type ThemeMode } from '../providers/ThemeProvider';

export function SessionPreferencesSync() {
  const { status } = useSession();
  const { locale, setLocale } = useLocale();
  const { setTheme } = useTheme();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || loadedRef.current) {
      return;
    }

    loadedRef.current = true;

    const countryHint = readCountryHint();
    const browserLanguages = detectBrowserLocales();

    void fetch('/api/user/preferences', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          preferredLocale?: string | null;
          preferredTheme?: string | null;
          jurisdiction?: string | null;
        } | null) => {
          if (!data) {
            return;
          }

          const geoCountry = normalizePaymentCountry(data.jurisdiction ?? countryHint ?? 'AR');
          const manual = readLocaleManualFlag();
          const resolvedLocale = resolveInitialLocale({
            stored: manual ? data.preferredLocale ?? locale : null,
            countryHint: geoCountry,
            browserLanguages,
            manual
          });

          const patchBody: {
            preferredLocale?: string;
            jurisdiction?: string;
          } = {};

          if (!manual && resolvedLocale !== locale) {
            setLocale(resolvedLocale);
            setLocaleManualFlag(false);
            patchBody.preferredLocale = resolvedLocale;
          } else if (
            !manual &&
            data.preferredLocale &&
            data.preferredLocale !== resolvedLocale
          ) {
            patchBody.preferredLocale = resolvedLocale;
            setLocale(resolvedLocale);
          }

          if (!data.jurisdiction && countryHint) {
            patchBody.jurisdiction = geoCountry;
          }

          if (Object.keys(patchBody).length > 0) {
            void fetch('/api/user/preferences', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patchBody)
            }).catch(() => undefined);
          }

          if (data.preferredTheme === 'light' || data.preferredTheme === 'dark') {
            setTheme(data.preferredTheme as ThemeMode);
          }
        }
      )
      .catch(() => undefined);
  }, [locale, setLocale, setTheme, status]);

  return null;
}
