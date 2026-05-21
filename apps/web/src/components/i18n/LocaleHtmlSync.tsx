'use client';

import { useEffect } from 'react';
import { rtlLocales } from '../../i18n';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';

/** Keeps <html lang/dir> and document title aligned with the user-selected locale. */
export function LocaleHtmlSync() {
  const { locale } = useLocale();
  const t = useTranslation();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = rtlLocales.includes(locale) ? 'rtl' : 'ltr';
    document.title = t.meta.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', t.meta.description);
    }
  }, [locale, t.meta.description, t.meta.title]);

  return null;
}
