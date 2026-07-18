import { formatMessage, rtlLocales, type Locale } from '../../../i18n';
import type { EmailMessages } from './types';
import { en } from './en';
import { mergeEmailLocale } from './mergeEmailLocale';
import { ar } from './ar';
import { bn } from './bn';
import { de } from './de';
import { es } from './es';
import { fr } from './fr';
import { he } from './he';
import { hi } from './hi';
import { id } from './id';
import { ja } from './ja';
import { mr } from './mr';
import { pt } from './pt';
import { ru } from './ru';
import { sw } from './sw';
import { ur } from './ur';
import { zh } from './zh';

const emailMessagesByLocale: Record<Locale, EmailMessages> = {
  en,
  es: mergeEmailLocale(es),
  zh: mergeEmailLocale(zh),
  hi: mergeEmailLocale(hi),
  fr: mergeEmailLocale(fr),
  ar: mergeEmailLocale(ar),
  bn: mergeEmailLocale(bn),
  pt: mergeEmailLocale(pt),
  ru: mergeEmailLocale(ru),
  ur: mergeEmailLocale(ur),
  id: mergeEmailLocale(id),
  de: mergeEmailLocale(de),
  ja: mergeEmailLocale(ja),
  sw: mergeEmailLocale(sw),
  mr: mergeEmailLocale(mr),
  he: mergeEmailLocale(he)
};

const DEFAULT_EMAIL_LOCALE: Locale = 'es';

/** Resolves the transactional-email copy for a given locale, falling back to Spanish (the platform default). */
export function getEmailMessages(locale?: string | null): EmailMessages {
  if (locale && locale in emailMessagesByLocale) {
    return emailMessagesByLocale[locale as Locale];
  }
  return emailMessagesByLocale[DEFAULT_EMAIL_LOCALE];
}

export function isRtlEmailLocale(locale?: string | null): boolean {
  return Boolean(locale) && rtlLocales.includes(locale as Locale);
}

export { formatMessage as applyEmailTemplate };
export type { EmailMessages };
