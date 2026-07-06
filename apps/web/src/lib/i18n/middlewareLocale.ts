import { defaultLocale, isLocaleCode, type Locale } from './localeCodes';

const BROWSER_LANGUAGE_MAP: Record<string, Locale> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  es: 'es',
  'es-ar': 'es',
  'es-mx': 'es',
  'es-es': 'es',
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  hi: 'hi',
  fr: 'fr',
  ar: 'ar',
  bn: 'bn',
  pt: 'pt',
  'pt-br': 'pt',
  ru: 'ru',
  ur: 'ur',
  id: 'id',
  de: 'de',
  ja: 'ja',
  sw: 'sw',
  mr: 'mr'
};

const COUNTRY_LOCALE_HINT: Record<string, Locale> = {
  AR: 'es',
  ES: 'es',
  MX: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  UY: 'es',
  PY: 'es',
  BO: 'es',
  EC: 'es',
  VE: 'es',
  CR: 'es',
  PA: 'es',
  DO: 'es',
  GT: 'es',
  HN: 'es',
  NI: 'es',
  SV: 'es',
  PR: 'es',
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  BR: 'pt',
  PT: 'pt',
  FR: 'fr',
  DE: 'de',
  IT: 'de',
  CN: 'zh',
  TW: 'zh',
  HK: 'zh',
  IN: 'hi',
  JP: 'ja',
  ID: 'id',
  RU: 'ru',
  SA: 'ar',
  AE: 'ar',
  PK: 'ur',
  BD: 'bn',
  KE: 'sw',
  TZ: 'sw'
};

export function mapBrowserLanguageToLocale(language: string | null | undefined): Locale | null {
  if (!language) {
    return null;
  }

  const normalized = language.trim().toLowerCase().replace(/_/g, '-');
  if (BROWSER_LANGUAGE_MAP[normalized]) {
    return BROWSER_LANGUAGE_MAP[normalized];
  }

  const base = normalized.split('-')[0];
  if (base && BROWSER_LANGUAGE_MAP[base]) {
    return BROWSER_LANGUAGE_MAP[base];
  }

  if (isLocaleCode(normalized)) {
    return normalized;
  }

  return null;
}

export function mapCountryToLocaleHint(countryCode: string | null | undefined): Locale | null {
  if (!countryCode) {
    return null;
  }

  return COUNTRY_LOCALE_HINT[countryCode.trim().toUpperCase()] ?? null;
}

/** Edge-safe copy of resolveGeoLocale — no i18n message catalogs. */
export function resolveGeoLocaleForMiddleware(options: {
  stored?: string | null;
  countryHint?: string | null;
  browserLanguages?: string[];
  manual?: boolean;
}): Locale {
  const stored = options.stored?.trim();
  const validStored = stored && isLocaleCode(stored) ? stored : null;

  if (options.manual && validStored) {
    return validStored;
  }

  for (const language of options.browserLanguages ?? []) {
    const browserLocale = mapBrowserLanguageToLocale(language);
    if (browserLocale) {
      return browserLocale;
    }
  }

  if (validStored) {
    return validStored;
  }

  const country = options.countryHint?.trim().toUpperCase() || null;
  const fromCountry = mapCountryToLocaleHint(country);
  if (fromCountry) {
    return fromCountry;
  }

  return defaultLocale;
}
