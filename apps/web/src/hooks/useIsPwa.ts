'use client';

import { useState, useEffect } from 'react';

export function useIsPwa() {
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkIsPwa = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      setIsPwa(isStandalone || isIosStandalone);
    };

    checkIsPwa();
    
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkIsPwa();
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isPwa;
}
