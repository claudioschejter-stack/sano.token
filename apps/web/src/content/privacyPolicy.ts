export type { PrivacySection, PrivacyDocument } from './legal/types';

import type { PrivacyDocument } from './legal/types';
import { sanitizePrivacyDocument } from './legal/sanitize';
import { privacyEn } from './legal/catalog-privacy-en';
import { privacyEs } from './legal/catalog-privacy-es';
import { privacyAr } from './legal/locales/ar';
import { privacyBn } from './legal/locales/bn';
import { privacyDe } from './legal/locales/de';
import { privacyFr } from './legal/locales/fr';
import { privacyHi } from './legal/locales/hi';
import { privacyId } from './legal/locales/id';
import { privacyJa } from './legal/locales/ja';
import { privacyMr } from './legal/locales/mr';
import { privacyPt } from './legal/locales/pt';
import { privacyRu } from './legal/locales/ru';
import { privacySw } from './legal/locales/sw';
import { privacyUr } from './legal/locales/ur';
import { privacyZh } from './legal/locales/zh';

const PRIVACY_BY_LOCALE: Record<string, PrivacyDocument> = {
  es: privacyEs,
  en: privacyEn,
  zh: privacyZh,
  hi: privacyHi,
  fr: privacyFr,
  ar: privacyAr,
  bn: privacyBn,
  pt: privacyPt,
  ru: privacyRu,
  ur: privacyUr,
  id: privacyId,
  de: privacyDe,
  ja: privacyJa,
  sw: privacySw,
  mr: privacyMr
};

const FALLBACK_LOCALES = ['en', 'es'];

/** Spanish is authoritative; other locales are auto-translated with en/es fallback. */
export function getPrivacyPolicy(locale: string): PrivacyDocument {
  const localesToTry = [locale, ...FALLBACK_LOCALES.filter((code) => code !== locale)];
  for (const code of localesToTry) {
    const document = PRIVACY_BY_LOCALE[code];
    if (document) {
      return sanitizePrivacyDocument(document);
    }
  }
  return sanitizePrivacyDocument(privacyEs);
}
