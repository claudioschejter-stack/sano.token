const DEFAULT_BLOCKED_COUNTRIES = 'IR,RU,KP,SY,CU,VE,MM,SD,BY,AF,SO,YE,LY,SS';

function buildBlockedCountriesSet(): Set<string> {
  const raw = process.env.BLOCKED_REGISTRATION_COUNTRIES?.trim() || DEFAULT_BLOCKED_COUNTRIES;
  return new Set(raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean));
}

/**
 * Single source of truth for geo-blocked registration countries, shared by
 * the page-level middleware redirect and the API route itself. Keeping the
 * check only in middleware left `/api/auth/register` reachable directly
 * (curl/devtools) from blocked countries even though the page redirected.
 */
export const BLOCKED_REGISTRATION_COUNTRIES = buildBlockedCountriesSet();

export function isCountryBlockedForRegistration(country: string | null | undefined): boolean {
  if (!country) {
    return false;
  }
  return BLOCKED_REGISTRATION_COUNTRIES.has(country.trim().toUpperCase());
}
