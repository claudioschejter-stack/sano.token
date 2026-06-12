'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { getGaMeasurementId } from '../../lib/analytics/analyticsConfig';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function GaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const measurementId = getGaMeasurementId();

  useEffect(() => {
    if (!measurementId || typeof window.gtag !== 'function') {
      return;
    }

    const query = searchParams.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;

    window.gtag('config', measurementId, { page_path: pagePath });
  }, [measurementId, pathname, searchParams]);

  return null;
}
