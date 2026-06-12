'use client';

import { useCallback } from 'react';
import { useLocale } from '../i18n/LocaleProvider';
import { withLocalePrefix } from '../lib/i18n/localeRouting';

export function useLocalePath() {
  const { locale } = useLocale();
  return useCallback((path: string) => withLocalePrefix(locale, path), [locale]);
}
