import { defaultLocale, locales, type Locale } from './index';
import { detectCountryFromTimezone, resolveGeoLocale } from '../lib/i18n/geoLocale';

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

/** Country ISO-3166 alpha-2 → locale hint (language is still overridden by browser). */
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

  if (locales.includes(normalized as Locale)) {
    return normalized as Locale;
  }

  return null;
}

export function mapCountryToLocaleHint(countryCode: string | null | undefined): Locale | null {
  if (!countryCode) {
    return null;
  }

  return COUNTRY_LOCALE_HINT[countryCode.trim().toUpperCase()] ?? null;
}

export function detectBrowserLocales(): Locale[] {
  if (typeof navigator === 'undefined') {
    return [];
  }

  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language
  ];

  const resolved: Locale[] = [];
  for (const candidate of candidates) {
    const locale = mapBrowserLanguageToLocale(candidate);
    if (locale && !resolved.includes(locale)) {
      resolved.push(locale);
    }
  }

  return resolved;
}

const COUNTRY_COOKIE = 'sanova.country';

export function readCountryHint(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([^;]*)`));
  const fromCookie = match?.[1] ? decodeURIComponent(match[1]) : null;
  return fromCookie ?? detectCountryFromTimezone();
}

/** Best locale from device/browser settings (ignores stored preference). */
export function detectDeviceLocale(countryHint?: string | null): Locale {
  const browserLanguageTags =
    typeof navigator === 'undefined'
      ? []
      : [...(navigator.languages ?? []), navigator.language].filter(
          (value): value is string => typeof value === 'string' && value.length > 0
        );

  return resolveInitialLocale({
    stored: null,
    countryHint: countryHint ?? readCountryHint(),
    browserLanguages: browserLanguageTags
  });
}

export function resolveInitialLocale(options: {
  stored?: string | null;
  countryHint?: string | null;
  browserLanguages?: string[];
  manual?: boolean;
}): Locale {
  return resolveGeoLocale(options);
}
