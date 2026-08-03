/**
 * One-time recovery: pause Custom Auth JWT sync so the investor can log into
 * the legacy email Privy user that still owns the funded Sanova wallet, then
 * grant the app authorization key as an additional signer.
 */

export const LEGACY_SIGNER_GRANT_EVENT = 'sanova-legacy-signer-grant';
const FLAG_KEY = 'sanova.privy.legacySignerGrant';

export function isLegacySignerGrantActive(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(FLAG_KEY) === '1';
}

export function setLegacySignerGrantActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  if (active) {
    window.sessionStorage.setItem(FLAG_KEY, '1');
  } else {
    window.sessionStorage.removeItem(FLAG_KEY);
  }
  window.dispatchEvent(new Event(LEGACY_SIGNER_GRANT_EVENT));
}
