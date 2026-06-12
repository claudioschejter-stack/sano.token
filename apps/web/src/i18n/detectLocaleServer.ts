import { cookies, headers } from 'next/headers';
import { LOCALE_STORAGE_KEY } from '../lib/i18n/mobileLocalePreference';
import {
  mapBrowserLanguageToLocale,
  mapCountryToLocaleHint,
  resolveInitialLocale
} from './detectLocale';
import { defaultLocale, type Locale } from './index';

const COUNTRY_COOKIE = 'sanova.country';

function parseAcceptLanguage(header: string | null): string[] {
  if (!header) {
    return [];
  }

  return header
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter((value): value is string => Boolean(value));
}

/** Server-side locale for SSR metadata and `<html lang>`. */
export async function resolveServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(LOCALE_STORAGE_KEY)?.value;
  const countryHint = cookieStore.get(COUNTRY_COOKIE)?.value;

  const headerStore = await headers();
  const browserLanguages = parseAcceptLanguage(headerStore.get('accept-language'));

  return resolveInitialLocale({
    stored,
    countryHint,
    browserLanguages
  });
}

export function resolveLocaleFromRequest(options: {
  stored?: string | null;
  countryHint?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  const browserLanguages = parseAcceptLanguage(options.acceptLanguage ?? null);
  return resolveInitialLocale({
    stored: options.stored,
    countryHint: options.countryHint,
    browserLanguages
  });
}

export function detectLocaleFromAcceptLanguage(acceptLanguage: string | null): Locale {
  for (const tag of parseAcceptLanguage(acceptLanguage)) {
    const locale = mapBrowserLanguageToLocale(tag);
    if (locale) {
      return locale;
    }
  }
  return defaultLocale;
}

export function detectLocaleFromCountry(countryCode: string | null | undefined): Locale | null {
  return mapCountryToLocaleHint(countryCode);
}
