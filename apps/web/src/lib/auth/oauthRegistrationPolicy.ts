import { cookies, headers } from 'next/headers';
import { isCountryBlockedForRegistration } from '../security/blockedCountries';
import { OAUTH_TERMS_COOKIE } from './oauthRegistrationConstants';

export { OAUTH_TERMS_COOKIE };

/** IP header country for registration gates — same source as password register routes. */
export function resolveRegistrationCountryFromIp(
  countryHeader: string | null | undefined
): string | null {
  const trimmed = countryHeader?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

/**
 * Cookie-based country hint for locale/UX (e.g. i18n). Not used for geo-block gates.
 */
export async function resolveRegistrationCountryHint(): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get('sanova.country')?.value?.trim();
  if (fromCookie) {
    return fromCookie.toUpperCase();
  }

  const headerStore = await headers();
  return resolveRegistrationCountryFromIp(headerStore.get('x-vercel-ip-country'));
}

export async function isRegistrationCountryBlocked(): Promise<boolean> {
  const headerStore = await headers();
  const country = resolveRegistrationCountryFromIp(headerStore.get('x-vercel-ip-country'));
  return isCountryBlockedForRegistration(country);
}

export async function isOAuthTermsAccepted(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(OAUTH_TERMS_COOKIE)?.value === '1';
}
