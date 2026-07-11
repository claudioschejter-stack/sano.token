'use client';

import { useMemo, useSyncExternalStore } from 'react';

const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

function detectMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return MOBILE_UA.test(navigator.userAgent);
}

function detectMobileViewport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(max-width: 767px)').matches;
}

function getSnapshot(): boolean {
  return detectMobileUserAgent() || detectMobileViewport();
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('resize', onStoreChange);
  return () => window.removeEventListener('resize', onStoreChange);
}

/**
 * Uses useSyncExternalStore (rather than useState + useEffect) so the very
 * first client render already reflects the real device, with no flash of
 * the SSR-only `false` value that a plain useState initializer can leave
 * visible for a frame or two on a hard page reload.
 */
export function useDeviceDetection() {
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(
    () => ({
      isMobile,
      isDesktop: !isMobile
    }),
    [isMobile]
  );
}
