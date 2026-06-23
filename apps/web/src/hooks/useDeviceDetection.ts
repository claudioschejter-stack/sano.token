'use client';

import { useEffect, useMemo, useState } from 'react';

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

export function useDeviceDetection() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const sync = () => {
      setIsMobile(detectMobileUserAgent() || detectMobileViewport());
    };

    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return useMemo(
    () => ({
      isMobile,
      isDesktop: !isMobile
    }),
    [isMobile]
  );
}
