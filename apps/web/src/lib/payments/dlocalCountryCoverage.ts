import { paymentRowsForCountry, type PaymentCheckoutRow } from './paymentCheckoutCatalog';
import { isDLocalConfigured } from './paymentProviderAvailability';
import { normalizePaymentCountry } from './paymentCountry';

/** Countries where the checkout catalog defines dLocal local rails (SPEI, UPI, Pix, Modo, etc.). */
export const DLOCAL_LOCAL_RAIL_COUNTRIES = ['AR', 'BR', 'MX', 'IN', 'US', 'EU', 'CN'] as const;

export function isDLocalLocalRailRow(row: PaymentCheckoutRow): boolean {
  return row.method === 'LOCAL_RAIL' && row.provider === 'dlocal';
}

export function countryHasDLocalCatalogRails(country: string): boolean {
  const normalized = normalizePaymentCountry(country);
  return paymentRowsForCountry(normalized).some(isDLocalLocalRailRow);
}

/** True when dLocal API credentials exist and the country has local-rail rows in the catalog. */
export function isDLocalOperationalForCountry(country: string): boolean {
  if (!isDLocalConfigured()) {
    return false;
  }
  return countryHasDLocalCatalogRails(country);
}
