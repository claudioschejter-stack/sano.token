import { detectDeviceLocale } from '../../i18n/detectLocale';
import { resolveLocale, type Locale } from '../../i18n';
import { isMobileDevice } from '../mobile/deviceConfig';

export const LOCALE_STORAGE_KEY = 'sanova.locale';
export const LOCALE_PINNED_KEY = 'sanova.locale.pinned';
export const LOCALE_MANUAL_KEY = 'sanova.locale.manual';

function readCookieFlag(name: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.cookie.includes(`${name}=1`);
}

export function readLocaleManualFlag(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(LOCALE_MANUAL_KEY) === '1' || readCookieFlag(LOCALE_MANUAL_KEY);
}

export function setLocaleManualFlag(manual: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (manual) {
    window.localStorage.setItem(LOCALE_MANUAL_KEY, '1');
    document.cookie = `${LOCALE_MANUAL_KEY}=1; path=/; max-age=31536000; samesite=lax`;
    return;
  }

  window.localStorage.removeItem(LOCALE_MANUAL_KEY);
  document.cookie = `${LOCALE_MANUAL_KEY}=; path=/; max-age=0; samesite=lax`;
}

export function readPinnedMobileLocale(): Locale | null {
  if (typeof window === 'undefined' || !isMobileDevice()) {
    return null;
  }

  if (window.sessionStorage.getItem(LOCALE_PINNED_KEY) !== '1') {
    return null;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored ? resolveLocale(stored) : null;
}

export function pinMobileLocale(locale: Locale): void {
  if (typeof window === 'undefined' || !isMobileDevice()) {
    return;
  }

  window.sessionStorage.setItem(LOCALE_PINNED_KEY, '1');
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function resetMobileLocaleOnSignOut(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(LOCALE_PINNED_KEY);
  setLocaleManualFlag(false);

  if (isMobileDevice()) {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, detectDeviceLocale());
  }
}

export function applyDeviceLocaleOnMobile(): Locale {
  const deviceLocale = detectDeviceLocale();
  if (typeof window !== 'undefined' && isMobileDevice()) {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, deviceLocale);
  }
  return deviceLocale;
}
