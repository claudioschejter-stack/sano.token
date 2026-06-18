import type { DepositPaymentOption } from './depositPaymentOptions';
import { PRIVY_ON_RAMP_OPTION_ID, shouldOfferPrivyOnRampForCountry } from './privyOnRampPolicy';
import { normalizePaymentCountry } from './paymentCountry';

/** Apply dLocal-first / Privy-fallback / Mercado Pago visibility rules to checkout options. */
export function applyPaymentRoutePolicy(
  options: DepositPaymentOption[],
  country: string
): DepositPaymentOption[] {
  const normalized = normalizePaymentCountry(country);
  const offerPrivy = shouldOfferPrivyOnRampForCountry(normalized);

  return options.map((option) => {
    if (option.id === PRIVY_ON_RAMP_OPTION_ID) {
      return {
        ...option,
        configured: option.configured && offerPrivy
      };
    }

    if (option.method === 'LOCAL_RAIL' && option.provider === 'dlocal') {
      return {
        ...option,
        sortOrder: option.sortOrder - 500
      };
    }

    if (option.id === 'mercadopago_wallet' || option.id === 'mercado_pago') {
      return {
        ...option,
        sortOrder: option.sortOrder - 300
      };
    }

    return option;
  });
}
