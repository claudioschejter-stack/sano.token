'use client';

import { useState, useEffect } from 'react';

function detectIsPwa(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (window.navigator as any).standalone === true;
  return isStandalone || isIosStandalone;
}

export function useIsPwa() {
  // Lazy-initialized so the very first render already reflects standalone mode —
  // otherwise every consumer briefly renders the non-PWA branch before the
  // effect below runs, which reads as "it opened the website first".
  const [isPwa, setIsPwa] = useState(detectIsPwa);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkIsPwa = () => setIsPwa(detectIsPwa());

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkIsPwa();

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isPwa;
}
