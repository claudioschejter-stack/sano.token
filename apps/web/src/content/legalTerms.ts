export type { LegalTermsSection, LegalTermsDocument } from './legal/types';

import type { LegalTermsDocument } from './legal/types';
import { sanitizeLegalTermsDocument } from './legal/sanitize';
import { legalTermsEn } from './legal/catalog-terms-en';
import { legalTermsEs } from './legal/catalog-terms-es';
import { legalTermsAr } from './legal/locales/ar';
import { legalTermsBn } from './legal/locales/bn';
import { legalTermsDe } from './legal/locales/de';
import { legalTermsFr } from './legal/locales/fr';
import { legalTermsHi } from './legal/locales/hi';
import { legalTermsId } from './legal/locales/id';
import { legalTermsJa } from './legal/locales/ja';
import { legalTermsMr } from './legal/locales/mr';
import { legalTermsPt } from './legal/locales/pt';
import { legalTermsRu } from './legal/locales/ru';
import { legalTermsSw } from './legal/locales/sw';
import { legalTermsUr } from './legal/locales/ur';
import { legalTermsZh } from './legal/locales/zh';

const LEGAL_TERMS_BY_LOCALE: Record<string, LegalTermsDocument> = {
  es: legalTermsEs,
  en: legalTermsEn,
  zh: legalTermsZh,
  hi: legalTermsHi,
  fr: legalTermsFr,
  ar: legalTermsAr,
  bn: legalTermsBn,
  pt: legalTermsPt,
  ru: legalTermsRu,
  ur: legalTermsUr,
  id: legalTermsId,
  de: legalTermsDe,
  ja: legalTermsJa,
  sw: legalTermsSw,
  mr: legalTermsMr
};

const FALLBACK_LOCALES = ['en', 'es'];

/** Spanish is authoritative; other locales are auto-translated with en/es fallback. */
export function getLegalTerms(locale: string): LegalTermsDocument {
  const localesToTry = [locale, ...FALLBACK_LOCALES.filter((code) => code !== locale)];
  for (const code of localesToTry) {
    const document = LEGAL_TERMS_BY_LOCALE[code];
    if (document) {
      return sanitizeLegalTermsDocument(document);
    }
  }
  return sanitizeLegalTermsDocument(legalTermsEs);
}
