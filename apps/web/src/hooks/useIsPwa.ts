'use client';

import { useSyncExternalStore } from 'react';

function detectIsPwa(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandalone || isIosStandalone;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

/**
 * Uses useSyncExternalStore so the very first client render already
 * reflects standalone/PWA mode — otherwise every consumer briefly renders
 * the non-PWA branch before an effect runs, which reads as "it opened the
 * website first" (and, combined with other independent detection hooks,
 * can cause visible duplicate UI for a frame on hard reloads).
 */
export function useIsPwa() {
  return useSyncExternalStore(subscribe, detectIsPwa, getServerSnapshot);
}
