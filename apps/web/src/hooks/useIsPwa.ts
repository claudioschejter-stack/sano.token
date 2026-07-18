'use client';

import { useSyncExternalStore } from 'react';

function matchesDisplayMode(mode: string): boolean {
  return window.matchMedia(`(display-mode: ${mode})`).matches;
}

function detectIsPwa(): boolean {
  if (typeof window === 'undefined') return false;
  const isDisplayModeApp =
    matchesDisplayMode('standalone') ||
    matchesDisplayMode('fullscreen') ||
    matchesDisplayMode('minimal-ui');
  const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isDisplayModeApp || isIosStandalone;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  const modes = ['standalone', 'fullscreen', 'minimal-ui'] as const;
  const queries = modes.map((mode) => window.matchMedia(`(display-mode: ${mode})`));
  for (const query of queries) {
    query.addEventListener('change', onStoreChange);
  }
  return () => {
    for (const query of queries) {
      query.removeEventListener('change', onStoreChange);
    }
  };
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
