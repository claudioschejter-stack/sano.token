'use client';

import { useMemo } from 'react';
import { useDeviceDetection } from './useDeviceDetection';
import { useIsPwa } from './useIsPwa';

/**
 * True when the investor portal should use the Mercado Pago-style mobile shell:
 * installed PWA **or** mobile browser (phone/tablet viewport / UA).
 */
export function useMobilePortal() {
  const isPwa = useIsPwa();
  const { isMobile } = useDeviceDetection();

  return useMemo(() => isPwa || isMobile, [isMobile, isPwa]);
}
