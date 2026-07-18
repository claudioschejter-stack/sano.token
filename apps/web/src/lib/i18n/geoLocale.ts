import { defaultLocale, locales, type Locale } from '../../i18n';
import { mapBrowserLanguageToLocale, mapCountryToLocaleHint } from '../../i18n/detectLocale';

export const LOCALE_MANUAL_COOKIE = 'sanova.locale.manual';
export const STRICT_GEO_LOCALE_COUNTRIES = new Set([
  'AR',
  'ES',
  'MX',
  'CO',
  'CL',
  'PE',
  'UY',
  'PY',
  'BO',
  'EC',
  'VE',
  'CR',
  'PA',
  'DO',
  'GT',
  'HN',
  'NI',
  'SV',
  'PR',
  'BR',
  'PT',
  'FR',
  'DE',
  'JP',
  'CN',
  'TW',
  'HK',
  'IN',
  'ID',
  'RU',
  'SA',
  'AE',
  'PK',
  'BD',
  'KE',
  'TZ',
  'IL'
]);

const TIMEZONE_COUNTRY: Record<string, string> = {
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Argentina/Cordoba': 'AR',
  'America/Argentina/Salta': 'AR',
  'America/Argentina/Jujuy': 'AR',
  'America/Argentina/Tucuman': 'AR',
  'America/Argentina/Catamarca': 'AR',
  'America/Argentina/La_Rioja': 'AR',
  'America/Argentina/San_Juan': 'AR',
  'America/Argentina/Mendoza': 'AR',
  'America/Argentina/San_Luis': 'AR',
  'America/Argentina/Rio_Gallegos': 'AR',
  'America/Argentina/Ushuaia': 'AR',
  'America/Buenos_Aires': 'AR',
  'America/Mexico_City': 'MX',
  'America/Santiago': 'CL',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',
  'America/Montevideo': 'UY',
  'America/Sao_Paulo': 'BR',
  'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Asia/Jerusalem': 'IL'
};

export function detectCountryFromTimezone(): string | null {
  if (typeof Intl === 'undefined') {
    return null;
  }

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY[timeZone] ?? null;
  } catch {
    return null;
  }
}

export function isLocaleCompatibleWithCountry(
  locale: Locale,
  country: string | null | undefined
): boolean {
  if (!country?.trim()) {
    return true;
  }

  const countryCode = country.trim().toUpperCase();
  const expected = mapCountryToLocaleHint(countryCode);
  if (!expected || !STRICT_GEO_LOCALE_COUNTRIES.has(countryCode)) {
    return true;
  }

  return locale === expected;
}

export function resolveGeoLocale(options: {
  stored?: string | null;
  countryHint?: string | null;
  browserLanguages?: string[];
  manual?: boolean;
}): Locale {
  const stored = options.stored?.trim();
  const validStored = stored && locales.includes(stored as Locale) ? (stored as Locale) : null;

  // An explicit user choice always wins — automatic detection never overrides it.
  if (options.manual && validStored) {
    return validStored;
  }

  // Primary automatic signal: the device/browser language. This is what the user
  // actually configured on their phone/computer, and is far more reliable than IP
  // geolocation (mobile carriers routing through a neighboring country's IP ranges
  // is common in South America and used to force the wrong language here).
  for (const language of options.browserLanguages ?? []) {
    const browserLocale = mapBrowserLanguageToLocale(language);
    if (browserLocale) {
      return browserLocale;
    }
  }

  // No usable browser-language signal: keep whatever locale was already resolved.
  if (validStored) {
    return validStored;
  }

  // Last resort: IP-based country hint (kept mainly so country data stays available
  // for other uses, e.g. picking a default local payment method).
  const country = options.countryHint?.trim().toUpperCase() || null;
  const fromCountry = mapCountryToLocaleHint(country);
  if (fromCountry) {
    return fromCountry;
  }

  return defaultLocale;
}

export function localeForCountry(country: string | null | undefined): Locale {
  return resolveGeoLocale({
    stored: null,
    countryHint: country,
    browserLanguages: []
  });
}
