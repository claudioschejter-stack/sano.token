/**
 * Product policy for which payment rails to emphasize by investor country.
 * Settlement is always USDC on Base into the Sanova treasury.
 */

import { isBridgeWireCountry } from './bridgeClient';

export type CheckoutRailId =
  | 'crypto_usdc'
  | 'fiat_wallet_ar'
  | 'card_on_ramp'
  | 'bridge_wire'
  | 'transak_wire';

export type CheckoutRailRecommendation = {
  country: string;
  primary: CheckoutRailId[];
  notes: string;
};

export function recommendCheckoutRails(country: string): CheckoutRailRecommendation {
  const c = country.trim().toUpperCase() || 'US';

  if (c === 'AR') {
    return {
      country: c,
      primary: ['crypto_usdc', 'fiat_wallet_ar', 'card_on_ramp'],
      notes: 'Argentina: Mercado Pago + Ripio + USDC wallet. Bridge wire is not the AR path.'
    };
  }

  if (isBridgeWireCountry(c)) {
    return {
      country: c,
      primary: ['crypto_usdc', 'bridge_wire', 'card_on_ramp'],
      notes:
        'Bridge Virtual Account (USD ACH/wire, EUR SEPA, MXN SPEI, BRL Pix, GBP FPS) → USDC Base + cards/USDC wallet.'
    };
  }

  return {
    country: c,
    primary: ['crypto_usdc', 'card_on_ramp', 'transak_wire'],
    notes: 'Default: USDC wallet + Transak card/bank; Bridge only when country is in the VA set.'
  };
}
