/**
 * Product policy for which payment rails to emphasize by investor country.
 * Settlement is always USDC on Base into the Sanova treasury.
 *
 * Which provider collects each fiat lane is decided in `fiatRailPolicy`, so the
 * recommendation shown to an investor cannot name a rail the checkout resolver
 * will refuse to open.
 */

import { bridgeCollectsIn, macroCollectsIn } from './fiatRailPolicy';

export type CheckoutRailId =
  | 'crypto_usdc'
  | 'fiat_wallet_ar'
  | 'macro_card'
  | 'macro_wire'
  | 'bridge_wire';

export type CheckoutRailRecommendation = {
  country: string;
  primary: CheckoutRailId[];
  notes: string;
};

export function recommendCheckoutRails(country: string): CheckoutRailRecommendation {
  const c = country.trim().toUpperCase() || 'US';

  if (macroCollectsIn(c)) {
    return {
      country: c,
      primary: ['crypto_usdc', 'fiat_wallet_ar', 'macro_card', 'macro_wire'],
      notes:
        'Argentina: Macro cobra tarjeta y transferencia, Mercado Pago / Ripio la billetera, USDC directo el resto. Bridge no es el camino argentino.'
    };
  }

  if (bridgeCollectsIn(c)) {
    return {
      country: c,
      primary: ['crypto_usdc', 'bridge_wire'],
      notes:
        'Bridge Virtual Account (USD ACH/wire, EUR SEPA, MXN SPEI, BRL Pix, COP Bre-B, GBP FPS) → USDC Base, más USDC directo.'
    };
  }

  /**
   * Neither collector reaches this country, so USDC is the only lane. Naming a
   * fiat rail here would advertise a checkout that cannot be completed.
   */
  return {
    country: c,
    primary: ['crypto_usdc'],
    notes: 'Sin cobrador fiat en este país: sólo USDC directo a la tesorería en Base.'
  };
}
