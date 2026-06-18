import type { PaymentMethod } from '@sanova/database';

export type PaymentCheckoutGroupId =
  | 'linked_wallet'
  | 'argentina'
  | 'global_cards'
  | 'latam'
  | 'asia'
  | 'international';

export type PaymentProviderId =
  | 'usdc'
  | 'stripe'
  | 'mercado_pago'
  | 'dlocal'
  | 'ebanx'
  | 'astropay'
  | 'bridge'
  | 'wise'
  | 'transak'
  | 'ripio'
  | 'ramp'
  | 'binance'
  | 'coinbase'
  | 'custodial'
  | 'privy';

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
    id: 'binance_usdc',
    groupId: 'linked_wallet',
    method: 'USDC_ONCHAIN',
    label: 'Binance Wallet',
    provider: 'binance',
    providerRail: 'binance_usdc',
    fallbackFeeBps: 35,
    fallbackGasUsd: 0.03,
    fallbackNetworkUsd: 0.01,
    stablecoinNetwork: 'BASE',
    sortOrder: 20
  },
  {
    id: 'coinbase_pay',
    groupId: 'linked_wallet',
    method: 'USDC_ONCHAIN',
    label: 'Coinbase Pay',
    provider: 'coinbase',
    providerRail: 'coinbase_pay',
    fallbackFeeBps: 90,
    fallbackGasUsd: 0.02,
    fallbackNetworkUsd: 0.01,
    stablecoinNetwork: 'BASE',
    sortOrder: 18
  },
  {
    id: 'coinbase_commerce',
    groupId: 'international',
    method: 'COINBASE',
    label: 'Tarjeta de débito, crédito y transferencia',
    provider: 'coinbase',
    providerRail: 'commerce',
    fallbackFeeBps: 100,
    fallbackGasUsd: 0.03,
    fallbackNetworkUsd: 0.02,
    stablecoinNetwork: 'BASE',
    excludedCountries: ['AR'],
    sortOrder: 55
  },
  {
    id: 'binance_pay',
    groupId: 'international',
    method: 'USDC_ONCHAIN',
    label: 'Binance Pay',
    provider: 'binance',
    providerRail: 'binance_pay',
    fallbackFeeBps: 80,
    fallbackGasUsd: 0.03,
    fallbackNetworkUsd: 0.02,
    stablecoinNetwork: 'BASE',
    sortOrder: 58
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
    id: 'modo',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'Modo',
    provider: 'dlocal',
    providerRail: 'modo_qr',
    fallbackFeeBps: 55,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 100
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
    id: 'brubank',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'Brubank',
    provider: 'dlocal',
    providerRail: 'bank_transfer_ar',
    fallbackFeeBps: 50,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 120
  },
  {
    id: 'galicia',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'Banco Galicia',
    provider: 'dlocal',
    providerRail: 'modo_qr',
    fallbackFeeBps: 50,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 130
  },
  {
    id: 'naranja_x',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'Naranja X',
    provider: 'dlocal',
    providerRail: 'card',
    fallbackFeeBps: 280,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 140
  },
  {
    id: 'ypf_app',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'App YPF',
    provider: 'dlocal',
    providerRail: 'wallet',
    fallbackFeeBps: 65,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 150
  },
  {
    id: 'carrefour_banco',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'Carrefour Banco',
    provider: 'dlocal',
    providerRail: 'bank_transfer_ar',
    fallbackFeeBps: 50,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 160
  },
  {
    id: 'arq',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'ARQ',
    provider: 'dlocal',
    providerRail: 'bank_transfer_ar',
    fallbackFeeBps: 50,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 170
  },
  {
    id: 'astropay',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'AstroPay',
    provider: 'astropay',
    providerRail: 'wallet',
    fallbackFeeBps: 180,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR', 'BR', 'MX'],
    sortOrder: 180
  },
  {
    id: 'local_transfer',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'Transferencia bancaria (AR)',
    provider: 'dlocal',
    providerRail: 'bank_transfer_ar',
    fallbackFeeBps: 45,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 190
  },
  {
    id: 'nubank',
    groupId: 'latam',
    method: 'LOCAL_RAIL',
    label: 'Nubank',
    provider: 'dlocal',
    providerRail: 'pix',
    fallbackFeeBps: 55,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['BR'],
    sortOrder: 300
  },
  {
    id: 'pix',
    groupId: 'latam',
    method: 'LOCAL_RAIL',
    label: 'Pix (Brasil)',
    provider: 'dlocal',
    providerRail: 'pix',
    fallbackFeeBps: 55,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['BR'],
    sortOrder: 310
  },
  {
    id: 'lemon',
    groupId: 'latam',
    method: 'LOCAL_RAIL',
    label: 'Lemon',
    provider: 'dlocal',
    providerRail: 'wallet',
    fallbackFeeBps: 120,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR', 'BR'],
    sortOrder: 320
  },
  {
    id: 'ripio',
    groupId: 'latam',
    method: 'LOCAL_RAIL',
    label: 'Ripio Wallet (dLocal)',
    provider: 'dlocal',
    providerRail: 'wallet',
    fallbackFeeBps: 140,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 335
  },
  {
    id: 'bonbit',
    groupId: 'latam',
    method: 'LOCAL_RAIL',
    label: 'Bonbit',
    provider: 'dlocal',
    providerRail: 'wallet',
    fallbackFeeBps: 140,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 340
  },
  {
    id: 'belo',
    groupId: 'latam',
    method: 'LOCAL_RAIL',
    label: 'Belo',
    provider: 'dlocal',
    providerRail: 'wallet',
    fallbackFeeBps: 120,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 350
  },
  {
    id: 'bitso',
    groupId: 'latam',
    method: 'LOCAL_RAIL',
    label: 'Bitso',
    provider: 'dlocal',
    providerRail: 'wallet',
    fallbackFeeBps: 150,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR', 'MX'],
    sortOrder: 360
  },
  {
    id: 'spei',
    groupId: 'latam',
    method: 'LOCAL_RAIL',
    label: 'SPEI (México)',
    provider: 'dlocal',
    providerRail: 'spei',
    fallbackFeeBps: 45,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['MX'],
    sortOrder: 365
  },
  {
    id: 'alipay',
    groupId: 'asia',
    method: 'LOCAL_RAIL',
    label: 'Alipay',
    provider: 'dlocal',
    providerRail: 'alipay',
    fallbackFeeBps: 120,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['CN'],
    sortOrder: 400
  },
  {
    id: 'wechat_pay',
    groupId: 'asia',
    method: 'LOCAL_RAIL',
    label: 'WeChat Pay',
    provider: 'dlocal',
    providerRail: 'wechat_pay',
    fallbackFeeBps: 120,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['CN'],
    sortOrder: 410
  },
  {
    id: 'phonepe',
    groupId: 'asia',
    method: 'LOCAL_RAIL',
    label: 'PhonePe',
    provider: 'dlocal',
    providerRail: 'upi',
    fallbackFeeBps: 90,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['IN'],
    sortOrder: 420
  },
  {
    id: 'wise',
    groupId: 'international',
    method: 'BRIDGE',
    label: 'Wise',
    provider: 'wise',
    providerRail: 'international_transfer',
    fallbackFeeBps: 95,
    fallbackGasUsd: 0.05,
    fallbackNetworkUsd: 0.04,
    usesLocalCurrency: true,
    sortOrder: 500
  },
  {
    id: 'bridge',
    groupId: 'international',
    method: 'BRIDGE',
    label: 'Tarjeta de débito, crédito y transferencia',
    provider: 'bridge',
    providerRail: 'on_ramp',
    fallbackFeeBps: 80,
    fallbackGasUsd: 0.12,
    fallbackNetworkUsd: 0.05,
    usesLocalCurrency: true,
    sortOrder: 510
  },
  {
    id: 'ach',
    groupId: 'international',
    method: 'LOCAL_RAIL',
    label: 'ACH (EE.UU.)',
    provider: 'dlocal',
    providerRail: 'ach',
    fallbackFeeBps: 40,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    countries: ['US'],
    sortOrder: 520
  },
  {
    id: 'sepa',
    groupId: 'international',
    method: 'LOCAL_RAIL',
    label: 'SEPA (Europa)',
    provider: 'dlocal',
    providerRail: 'sepa',
    fallbackFeeBps: 35,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true,
    countries: ['EU'],
    sortOrder: 530
  },
  {
    id: 'transak',
    groupId: 'international',
    method: 'TRANSAK',
    label: 'Tarjeta de débito, crédito y transferencia',
    provider: 'transak',
    providerRail: 'on_ramp',
    fallbackFeeBps: 180,
    fallbackGasUsd: 0.08,
    fallbackNetworkUsd: 0.04,
    usesLocalCurrency: true,
    sortOrder: 540
  },
  {
    id: 'ramp',
    groupId: 'international',
    method: 'RAMP',
    label: 'Ramp Network',
    provider: 'ramp',
    providerRail: 'on_ramp',
    fallbackFeeBps: 200,
    fallbackGasUsd: 0.07,
    fallbackNetworkUsd: 0.04,
    usesLocalCurrency: true,
    sortOrder: 550
  },
  {
    id: 'privy_on_ramp',
    groupId: 'international',
    method: 'TRANSAK',
    label: 'Tarjeta / Apple Pay (Privy)',
    provider: 'privy',
    providerRail: 'privy_on_ramp',
    fallbackFeeBps: 180,
    fallbackGasUsd: 0.05,
    fallbackNetworkUsd: 0.03,
    stablecoinNetwork: 'BASE',
    sortOrder: 520
  },
  {
    id: 'loan_account',
    groupId: 'international',
    method: 'CUSTODIAL_STABLECOIN',
    label: 'Cuenta de préstamo',
    provider: 'custodial',
    providerRail: 'custodial_balance',
    fallbackFeeBps: 40,
    fallbackGasUsd: 0.02,
    fallbackNetworkUsd: 0.01,
    sortOrder: 560
  }
];

export function paymentRowsForCountry(country: string): PaymentCheckoutRow[] {
  const normalized = country.trim().toUpperCase();
  return PAYMENT_CHECKOUT_ROWS.filter(
    (row) =>
      (!row.countries || row.countries.includes(normalized)) &&
      (!row.excludedCountries || !row.excludedCountries.includes(normalized))
  ).sort((a, b) => a.sortOrder - b.sortOrder);
}
