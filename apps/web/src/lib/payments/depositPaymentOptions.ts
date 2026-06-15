import type { PaymentMethod } from '@sanova/database';
import { quoteCheapestPaymentRoutes } from './cheapestPaymentRouter';
import {
  PAYMENT_CHECKOUT_GROUP_ORDER,
  PAYMENT_CHECKOUT_ROWS,
  type PaymentCheckoutGroupId,
  type PaymentCheckoutRow,
  paymentRowsForCountry
} from './paymentCheckoutCatalog';
import { isPaymentCountrySanctioned, normalizePaymentCountry } from './paymentCountry';
import { isDepositCheckoutRowConfigured } from './paymentProviderAvailability';
import { enabledStablecoinNetworks } from './stablecoinNetworks';

export const DEPOSIT_QUOTE_TTL_SECONDS = 40;

function toUsdAmount(value: number | string | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function compareDepositPaymentOptions(
  a: DepositPaymentOption,
  b: DepositPaymentOption
): number {
  if (a.configured !== b.configured) {
    return a.configured ? -1 : 1;
  }

  const totalDiff = toUsdAmount(a.totalUsd) - toUsdAmount(b.totalUsd);
  if (totalDiff !== 0) {
    return totalDiff;
  }

  const feeDiff = toUsdAmount(a.feeUsd) - toUsdAmount(b.feeUsd);
  if (feeDiff !== 0) {
    return feeDiff;
  }

  return a.sortOrder - b.sortOrder;
}

export function sortDepositPaymentOptions(options: DepositPaymentOption[]): DepositPaymentOption[] {
  return [...options].sort(compareDepositPaymentOptions);
}

export function partitionDepositPaymentOptions(options: DepositPaymentOption[]) {
  const sorted = sortDepositPaymentOptions(options);
  return {
    sorted,
    available: sorted.filter((row) => row.configured),
    unavailable: sorted.filter((row) => !row.configured)
  };
}

export type DepositPaymentOption = {
  id: string;
  groupId: PaymentCheckoutGroupId;
  method: PaymentMethod;
  label: string;
  provider: PaymentCheckoutRow['provider'];
  providerRail: string;
  platformFeeUsd: number;
  gasFeeUsd: number;
  networkFeeUsd: number;
  feeUsd: number;
  feeBps: number;
  totalUsd: number;
  totalLocal: number | null;
  displayCurrency: string;
  usesLocalCurrency: boolean;
  configured: boolean;
  stablecoinNetwork?: string;
  sortOrder: number;
};

export type DepositPaymentOptionGroup = {
  id: PaymentCheckoutGroupId;
  available: DepositPaymentOption[];
  unavailable: DepositPaymentOption[];
  options: DepositPaymentOption[];
};

export type DepositQuoteBundle = {
  options: DepositPaymentOption[];
  groups: DepositPaymentOptionGroup[];
  quoteExpiresAt: string;
  quoteTtlSeconds: number;
  baseCurrency: 'USD';
  localCurrency: string;
  fxRateUsdToLocal: number;
  recommendedOptionId: string | null;
  stablecoinNetworks: Array<{
    id: string;
    label: string;
    symbol: string;
    cheapestRank: number;
  }>;
};

const COUNTRY_LOCAL_CURRENCY: Record<string, string> = {
  AR: 'ARS',
  BR: 'BRL',
  US: 'USD',
  EU: 'EUR',
  MX: 'MXN',
  IN: 'INR',
  CN: 'CNY'
};

const FALLBACK_FX_USD_TO_LOCAL: Record<string, number> = {
  USD: 1,
  ARS: 1050,
  BRL: 5.1,
  EUR: 0.92,
  MXN: 17.5,
  INR: 83,
  CNY: 7.2
};

export type BuildDepositPaymentOptionsContext = {
  linkedWalletAddress?: string | null;
};

export function getPaymentCheckoutRowById(optionId: string): PaymentCheckoutRow | null {
  return PAYMENT_CHECKOUT_ROWS.find((row) => row.id === optionId) ?? null;
}

export function groupDepositPaymentOptions(options: DepositPaymentOption[]): DepositPaymentOptionGroup[] {
  const byGroup = new Map<PaymentCheckoutGroupId, DepositPaymentOption[]>();

  for (const option of sortDepositPaymentOptions(options)) {
    const bucket = byGroup.get(option.groupId) ?? [];
    bucket.push(option);
    byGroup.set(option.groupId, bucket);
  }

  return PAYMENT_CHECKOUT_GROUP_ORDER.flatMap((groupId) => {
    const rows = byGroup.get(groupId) ?? [];
    if (rows.length === 0) {
      return [];
    }

    return [
      {
        id: groupId,
        options: rows,
        available: rows.filter((row) => row.configured),
        unavailable: rows.filter((row) => !row.configured)
      }
    ];
  });
}

function lowestPlatformFeeUsd(method: PaymentMethod, amountUsd: number, country: string): number | null {
  const quotes = quoteCheapestPaymentRoutes({
    amountUsd,
    country,
    direction: 'FIAT_TO_BALANCE'
  });

  const match = quotes.find((quote) => quote.method === method);
  return match?.estimatedFeeUsd ?? null;
}

function estimateGasUsd(row: PaymentCheckoutRow): number {
  return row.fallbackGasUsd;
}

export function buildDepositPaymentOptions(
  amountUsd: number,
  country = 'AR',
  fxRateUsdToLocal?: number,
  context?: BuildDepositPaymentOptionsContext
): DepositQuoteBundle {
  const normalizedCountry = normalizePaymentCountry(country);
  if (isPaymentCountrySanctioned(normalizedCountry)) {
    const networks = enabledStablecoinNetworks().map((network) => ({
      id: network.id,
      label: network.label,
      symbol: network.symbol,
      cheapestRank: network.cheapestRank
    }));
    return {
      options: [],
      groups: [],
      quoteExpiresAt: new Date(Date.now() + DEPOSIT_QUOTE_TTL_SECONDS * 1000).toISOString(),
      quoteTtlSeconds: DEPOSIT_QUOTE_TTL_SECONDS,
      baseCurrency: 'USD',
      localCurrency: 'USD',
      fxRateUsdToLocal: 1,
      recommendedOptionId: null,
      stablecoinNetworks: networks
    };
  }

  const normalizedAmount = Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : 0;
  const localCurrency = COUNTRY_LOCAL_CURRENCY[normalizedCountry] ?? 'USD';
  const fxRate = fxRateUsdToLocal ?? FALLBACK_FX_USD_TO_LOCAL[localCurrency] ?? 1;
  const quoteExpiresAt = new Date(Date.now() + DEPOSIT_QUOTE_TTL_SECONDS * 1000).toISOString();

  const options = paymentRowsForCountry(normalizedCountry).map((row) => {
    const configured = isDepositCheckoutRowConfigured(row, context);

    const quotedPlatform = lowestPlatformFeeUsd(row.method, normalizedAmount, normalizedCountry);
    const platformFeeUsd =
      quotedPlatform ??
      (row.id === 'credit_card'
        ? (normalizedAmount * 350) / 10_000
        : row.id === 'debit_card'
          ? (normalizedAmount * 250) / 10_000
          : (normalizedAmount * row.fallbackFeeBps) / 10_000);

    const gasFeeUsd = estimateGasUsd(row);
    const networkFeeUsd = row.fallbackNetworkUsd;
    const feeUsd = platformFeeUsd + gasFeeUsd + networkFeeUsd;
    const totalUsd = normalizedAmount + feeUsd;
    const usesLocalCurrency = row.usesLocalCurrency === true && localCurrency !== 'USD';
    const totalLocal = usesLocalCurrency ? totalUsd * fxRate : null;

    const feeBps =
      normalizedAmount > 0 ? Math.round((feeUsd / normalizedAmount) * 10_000) : row.fallbackFeeBps;

    return {
      id: row.id,
      groupId: row.groupId,
      method: row.method,
      label: row.label,
      provider: row.provider,
      providerRail: row.providerRail,
      platformFeeUsd,
      gasFeeUsd,
      networkFeeUsd,
      feeUsd,
      feeBps,
      totalUsd,
      totalLocal,
      displayCurrency: usesLocalCurrency ? localCurrency : 'USD',
      usesLocalCurrency,
      configured,
      stablecoinNetwork: row.stablecoinNetwork,
      sortOrder: row.sortOrder
    };
  });

  const sorted = sortDepositPaymentOptions(options);
  const recommended =
    sorted.find((row) => row.configured && row.groupId === 'linked_wallet') ??
    (normalizedCountry === 'AR'
      ? sorted.find((row) => row.configured && row.groupId === 'argentina')
      : null) ??
    sorted.find((row) => row.configured) ??
    null;
  const networks = enabledStablecoinNetworks().map((network) => ({
    id: network.id,
    label: network.label,
    symbol: network.symbol,
    cheapestRank: network.cheapestRank
  }));

  return {
    options: sorted,
    groups: groupDepositPaymentOptions(sorted),
    quoteExpiresAt,
    quoteTtlSeconds: DEPOSIT_QUOTE_TTL_SECONDS,
    baseCurrency: 'USD',
    localCurrency,
    fxRateUsdToLocal: fxRate,
    recommendedOptionId: recommended?.id ?? null,
    stablecoinNetworks: networks
  };
}
