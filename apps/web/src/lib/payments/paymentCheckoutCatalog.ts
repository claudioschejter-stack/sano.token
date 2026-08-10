import type { PaymentMethod } from '@sanova/database';

export type PaymentCheckoutGroupId =
  | 'linked_wallet'
  | 'argentina'
  | 'global_cards'
  | 'latam'
  | 'asia'
  | 'international';

/**
 * Los cobradores que la plataforma realmente tiene.
 *
 * Se retiraron Stripe, EBANX, AstroPay, Wise, Ramp Network, Binance y Coinbase
 * Commerce: ninguno cobraba un peso para Sanova y varios ya estaban ocultos en
 * runtime, así que lo único que quedaba era código y variables de entorno que
 * hacían parecer que había más opciones de las que hay. La regla es Macro donde
 * Macro puede cobrar, Bridge donde no, Mercado Pago en Argentina, Ripio para
 * convertir ARS a USDC, y Privy para tarjeta y wallet.
 *
 * `usdc` es pago cripto directo desde una wallet conectada (MetaMask,
 * WalletConnect, Coinbase Wallet): es conectividad de wallet, no una pasarela.
 */
export type PaymentProviderId =
  | 'usdc'
  | 'mercado_pago'
  | 'bridge'
  | 'ripio'
  | 'privy'
  | 'macro_click';

export type PaymentCheckoutRow = {
  id: string;
  groupId: PaymentCheckoutGroupId;
  method: PaymentMethod;
  label: string;
  provider: PaymentProviderId;
  providerRail: string;
  fallbackFeeBps: number;
  fallbackGasUsd: number;
  fallbackNetworkUsd: number;
  stablecoinNetwork?: string;
  usesLocalCurrency?: boolean;
  /** ISO country codes; omit = visible in all countries */
  countries?: string[];
  /** ISO country codes where this row must not appear (e.g. Stripe in AR). */
  excludedCountries?: string[];
  sortOrder: number;
};

export const PAYMENT_CHECKOUT_GROUP_ORDER: PaymentCheckoutGroupId[] = [
  'linked_wallet',
  'argentina',
  'global_cards',
  'latam',
  'asia',
  'international'
];

export const PAYMENT_CHECKOUT_ROWS: PaymentCheckoutRow[] = [
  {
    id: 'privy_usdc',
    groupId: 'linked_wallet',
    method: 'USDC_ONCHAIN',
    label: 'Privy Wallet (USDC Base)',
    provider: 'privy',
    providerRail: 'privy_embedded_usdc',
    fallbackFeeBps: 10,
    fallbackGasUsd: 0.01,
    fallbackNetworkUsd: 0.01,
    stablecoinNetwork: 'BASE',
    sortOrder: 5
  },
  {
    id: 'electronic_wallet',
    groupId: 'linked_wallet',
    method: 'USDC_ONCHAIN',
    label: 'Coinbase Wallet',
    provider: 'usdc',
    providerRail: 'linked_wallet_usdc',
    fallbackFeeBps: 25,
    fallbackGasUsd: 0.02,
    fallbackNetworkUsd: 0.01,
    stablecoinNetwork: 'BASE',
    sortOrder: 10
  },
  {
    id: 'walletconnect_usdc',
    groupId: 'linked_wallet',
    method: 'USDC_ONCHAIN',
    label: 'WalletConnect',
    provider: 'usdc',
    providerRail: 'walletconnect_usdc',
    fallbackFeeBps: 25,
    fallbackGasUsd: 0.02,
    fallbackNetworkUsd: 0.01,
    stablecoinNetwork: 'BASE',
    sortOrder: 25
  },
  {
    id: 'metamask_usdc',
    groupId: 'linked_wallet',
    method: 'USDC_ONCHAIN',
    label: 'MetaMask',
    provider: 'usdc',
    providerRail: 'metamask_usdc',
    fallbackFeeBps: 25,
    fallbackGasUsd: 0.02,
    fallbackNetworkUsd: 0.01,
    stablecoinNetwork: 'BASE',
    sortOrder: 15
  },
  {
    id: 'ripio_on_ramp',
    groupId: 'argentina',
    method: 'RIPIO',
    label: 'Billetera electrónica',
    provider: 'ripio',
    providerRail: 'bank_transfer',
    fallbackFeeBps: 140,
    fallbackGasUsd: 0.05,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR'],
    stablecoinNetwork: 'BASE',
    sortOrder: 95
  },
  {
    id: 'mercadopago_wallet',
    groupId: 'argentina',
    method: 'MERCADO_PAGO',
    label: 'Mercado Pago',
    provider: 'mercado_pago',
    providerRail: 'wallet_embedded',
    fallbackFeeBps: 280,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 105
  },
  {
    id: 'mercado_pago',
    groupId: 'argentina',
    method: 'MERCADO_PAGO',
    label: 'Mercado Pago (redirect)',
    provider: 'mercado_pago',
    providerRail: 'checkout',
    fallbackFeeBps: 320,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.05,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 110
  },
  {
    id: 'macro_click_ars',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'Transferencia bancaria (ARS)',
    provider: 'macro_click',
    providerRail: 'macro_click_hosted_ars',
    fallbackFeeBps: 180,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 112
  },
  {
    id: 'macro_click_usd',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'Transferencia bancaria (USD)',
    provider: 'macro_click',
    providerRail: 'macro_click_hosted_usd',
    fallbackFeeBps: 180,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 113
  },
  {
    id: 'macro_click_debin',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'Débito inmediato desde tu banco',
    provider: 'macro_click',
    providerRail: 'macro_click_debin',
    fallbackFeeBps: 120,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 114
  },
  {
    id: 'bridge',
    groupId: 'international',
    method: 'BRIDGE',
    label: 'Transferencia bancaria internacional',
    provider: 'bridge',
    providerRail: 'international_transfer',
    fallbackFeeBps: 80,
    fallbackGasUsd: 0.12,
    fallbackNetworkUsd: 0.05,
    usesLocalCurrency: false,
    /** Keep AR on Mercado Pago / Ripio; Bridge covers USD/EUR/MXN/BRL/GBP VAs. */
    countries: ['US', 'EU', 'GB', 'CA', 'AU', 'MX', 'BR', 'DE', 'FR', 'ES', 'IT', 'NL', 'PT', 'IE'],
    excludedCountries: ['AR'],
    sortOrder: 510
  },
  {
    id: 'privy_on_ramp',
    groupId: 'international',
    method: 'PRIVY_ONRAMP',
    label: 'Tarjeta / Apple Pay (Privy)',
    provider: 'privy',
    providerRail: 'privy_on_ramp',
    fallbackFeeBps: 180,
    fallbackGasUsd: 0.05,
    fallbackNetworkUsd: 0.03,
    stablecoinNetwork: 'BASE',
    sortOrder: 520
  },
];

export function paymentRowsForCountry(country: string): PaymentCheckoutRow[] {
  const normalized = country.trim().toUpperCase();
  return PAYMENT_CHECKOUT_ROWS.filter(
    (row) =>
      (!row.countries || row.countries.includes(normalized)) &&
      (!row.excludedCountries || !row.excludedCountries.includes(normalized))
  ).sort((a, b) => a.sortOrder - b.sortOrder);
}
