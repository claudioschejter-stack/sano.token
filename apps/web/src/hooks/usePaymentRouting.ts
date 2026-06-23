'use client';

import { useMemo, useState } from 'react';
import type { LocalFiatProviderId, PaymentRouteId } from '../lib/checkout/paymentRouteTypes';
import { useCheckoutPaymentCountry } from './useCheckoutPaymentCountry';
import { useDeviceDetection } from './useDeviceDetection';

export type UsePaymentRoutingOptions = {
  fallbackCurrency?: string;
  defaultRoute?: PaymentRouteId;
};

export function usePaymentRouting(options: UsePaymentRoutingOptions = {}) {
  const fallbackCurrency = options.fallbackCurrency ?? 'USD';
  const countryCode = useCheckoutPaymentCountry(fallbackCurrency);
  const { isMobile, isDesktop } = useDeviceDetection();
  const [selectedRoute, setSelectedRoute] = useState<PaymentRouteId | null>(null);
  const [localProvider, setLocalProvider] = useState<LocalFiatProviderId | null>(null);

  const isArgentina = countryCode === 'AR';

  const availableRoutes = useMemo<PaymentRouteId[]>(() => {
    const routes: PaymentRouteId[] = ['global_retail', 'global_institutional'];
    if (isArgentina) {
      routes.push('local_fiat');
    }
    return routes;
  }, [isArgentina]);

  const activeRoute = useMemo<PaymentRouteId>(() => {
    if (selectedRoute && availableRoutes.includes(selectedRoute)) {
      return selectedRoute;
    }
    if (options.defaultRoute && availableRoutes.includes(options.defaultRoute)) {
      return options.defaultRoute;
    }
    return isArgentina ? 'local_fiat' : 'global_retail';
  }, [availableRoutes, isArgentina, options.defaultRoute, selectedRoute]);

  return {
    countryCode,
    isMobile,
    isDesktop,
    isArgentina,
    availableRoutes,
    activeRoute,
    selectedRoute: activeRoute,
    setSelectedRoute,
    localProvider,
    setLocalProvider
  };
}
