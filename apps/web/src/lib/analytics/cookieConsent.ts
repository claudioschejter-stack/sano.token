const CONSENT_COOKIE = 'sanova.cookie-consent';
const CONSENT_DURATION_DAYS = 365;

export type ConsentValue = 'accepted' | 'rejected' | null;

export function getConsentFromCookie(): ConsentValue {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  const value = match.split('=')[1];
  if (value === 'accepted' || value === 'rejected') return value;
  return null;
}

export function setConsentCookie(value: 'accepted' | 'rejected'): void {
  const expires = new Date();
  expires.setDate(expires.getDate() + CONSENT_DURATION_DAYS);
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${secure}`;
}
