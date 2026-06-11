import { detectDeviceLocale } from '../../i18n/detectLocale';
import { resolveLocale, type Locale } from '../../i18n';
import { isMobileDevice } from '../mobile/deviceConfig';

export const LOCALE_STORAGE_KEY = 'sanova.locale';
export const LOCALE_PINNED_KEY = 'sanova.locale.pinned';

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
