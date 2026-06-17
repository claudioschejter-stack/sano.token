import type { DepositPaymentOption } from './depositPaymentOptions';

export const WALLET_CHECKOUT_ORDER = [
  'electronic_wallet',
  'metamask_usdc',
  'binance_usdc',
  'walletconnect_usdc'
] as const;

export const FIAT_ON_RAMP_SOURCE_IDS = [
  'transak',
  'bridge',
  'coinbase_commerce',
  'coinbase_pay',
  'binance_pay'
] as const;

export const HIDDEN_CHECKOUT_OPTION_IDS = new Set<string>([
  ...FIAT_ON_RAMP_SOURCE_IDS,
  'ramp'
]);

export const INDEPENDENT_FIAT_OPTION_IDS = new Set([
  'mercadopago_wallet',
  'mercado_pago',
  'wise'
]);

export const RIPIO_EWALLET_PARENT_ID = 'ripio_on_ramp';

export const RIPIO_EWALLET_RAILS: Array<{ rail: string; label: string }> = [
  { rail: 'modo', label: 'Modo' },
  { rail: 'uala', label: 'Ualá' },
  { rail: 'personal_pay', label: 'Personal Pay' },
  { rail: 'lemon', label: 'Lemon' },
  { rail: 'belo', label: 'Belo' },
  { rail: 'astropay', label: 'AstroPay' },
  { rail: 'naranja_x', label: 'Naranja X' }
];

export type CheckoutDisplaySections = {
  walletOptions: DepositPaymentOption[];
  fiatOnRampOption: DepositPaymentOption | null;
  ripioEwalletOption: DepositPaymentOption | null;
  independentOptions: DepositPaymentOption[];
};

export function sortWalletCheckoutOptions(options: DepositPaymentOption[]): DepositPaymentOption[] {
  const rank = new Map(WALLET_CHECKOUT_ORDER.map((id, index) => [id, index]));
  return [...options].sort((a, b) => {
    const aRank = rank.get(a.id as (typeof WALLET_CHECKOUT_ORDER)[number]) ?? 99;
    const bRank = rank.get(b.id as (typeof WALLET_CHECKOUT_ORDER)[number]) ?? 99;
    return aRank - bRank;
  });
}

export function pickFiatOnRampOption(options: DepositPaymentOption[]): DepositPaymentOption | null {
  for (const id of FIAT_ON_RAMP_SOURCE_IDS) {
    const match = options.find((row) => row.id === id && row.configured);
    if (match) return match;
  }
  return options.find((row) => FIAT_ON_RAMP_SOURCE_IDS.includes(row.id as (typeof FIAT_ON_RAMP_SOURCE_IDS)[number])) ?? null;
}

export function buildCheckoutDisplaySections(options: DepositPaymentOption[]): CheckoutDisplaySections {
  const visible = options.filter((row) => !HIDDEN_CHECKOUT_OPTION_IDS.has(row.id));
  const walletOptions = sortWalletCheckoutOptions(
    visible.filter((row) => WALLET_CHECKOUT_ORDER.includes(row.id as (typeof WALLET_CHECKOUT_ORDER)[number]))
  );
  const ripioEwalletOption = visible.find((row) => row.id === RIPIO_EWALLET_PARENT_ID) ?? null;
  const independentOptions = visible.filter((row) => INDEPENDENT_FIAT_OPTION_IDS.has(row.id));
  const fiatOnRampOption = pickFiatOnRampOption(options);

  return {
    walletOptions,
    fiatOnRampOption,
    ripioEwalletOption,
    independentOptions
  };
}

export function walletCheckoutOptionId(optionId: string | null): boolean {
  return WALLET_CHECKOUT_ORDER.includes(optionId as (typeof WALLET_CHECKOUT_ORDER)[number]);
}

export function autoConnectWalletOptionId(optionId: string | null): boolean {
  return optionId === 'electronic_wallet' || optionId === 'metamask_usdc' || optionId === 'binance_usdc';
}
