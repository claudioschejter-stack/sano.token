import { normalizePaymentCountry } from './paymentCountry';
export const PRIVY_ON_RAMP_OPTION_ID = 'privy_on_ramp';

const PRIVY_FIAT_BY_COUNTRY: Record<string, string> = {
  AR: 'ars',
  MX: 'mxn',
  BR: 'brl',
  IN: 'inr',
  US: 'usd',
  EU: 'eur',
  CN: 'cny',
  GB: 'gbp',
  CA: 'cad',
  AU: 'aud',
  CO: 'cop',
  CL: 'clp',
  SG: 'sgd'
};

export function isPrivyOnRampConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim());
}

/** Privy on-ramp is available whenever Privy is configured (cards / Apple Pay). */
export function shouldOfferPrivyOnRampForCountry(_country: string): boolean {
  return isPrivyOnRampConfigured();
}

export function privyFiatAssetForCountry(country: string): string {
  const normalized = normalizePaymentCountry(country);
  return PRIVY_FIAT_BY_COUNTRY[normalized] ?? 'usd';
}

/** Base mainnet CAIP-2 chain id for Privy fiat on-ramp destination. */
export const PRIVY_FIAT_ONRAMP_BASE_CHAIN = 'eip155:8453' as const;

const GLOBAL_FIAT_FALLBACKS = ['usd', 'eur'] as const;

/** Source currencies shown in Privy fiat on-ramp (country default + global fallbacks). */
export function resolvePrivyFiatOnRampSource(country: string): {
  assets: string[];
  defaultAsset: string;
} {
  const defaultAsset = privyFiatAssetForCountry(country);
  const assets = [...new Set([defaultAsset, ...GLOBAL_FIAT_FALLBACKS])];
  return { assets, defaultAsset };
}
