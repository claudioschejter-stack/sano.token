import type { PaymentMethod } from '@sanova/database';
import { quoteCheapestPaymentRoutes } from './cheapestPaymentRouter';
import { paymentGatewayConfigured } from './paymentConfig';

export const DEPOSIT_QUOTE_TTL_SECONDS = 40;

export type DepositPaymentOption = {
  id: string;
  method: PaymentMethod;
  label: string;
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
};

export type DepositQuoteBundle = {
  options: DepositPaymentOption[];
  quoteExpiresAt: string;
  quoteTtlSeconds: number;
  baseCurrency: 'USD';
  localCurrency: string;
  fxRateUsdToLocal: number;
};

type DepositDisplayRow = {
  id: string;
  method: PaymentMethod;
  label: string;
  fallbackFeeBps: number;
  fallbackGasUsd: number;
  fallbackNetworkUsd: number;
  stablecoinNetwork?: string;
  usesLocalCurrency?: boolean;
};

const COUNTRY_LOCAL_CURRENCY: Record<string, string> = {
  AR: 'ARS',
  BR: 'BRL',
  US: 'USD',
  EU: 'EUR',
  MX: 'MXN',
  IN: 'INR'
};

const FALLBACK_FX_USD_TO_LOCAL: Record<string, number> = {
  USD: 1,
  ARS: 1050,
  BRL: 5.1,
  EUR: 0.92,
  MXN: 17.5,
  INR: 83
};

const DEPOSIT_DISPLAY_ROWS: DepositDisplayRow[] = [
  {
    id: 'google_pay',
    method: 'STRIPE',
    label: 'Google Pay',
    fallbackFeeBps: 265,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03
  },
  {
    id: 'apple_pay',
    method: 'STRIPE',
    label: 'Apple Pay',
    fallbackFeeBps: 265,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03
  },
  {
    id: 'paypal',
    method: 'STRIPE',
    label: 'PayPal',
    fallbackFeeBps: 340,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.04,
    usesLocalCurrency: true
  },
  {
    id: 'debit_card',
    method: 'STRIPE',
    label: 'Tarjeta de débito',
    fallbackFeeBps: 250,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03
  },
  {
    id: 'credit_card',
    method: 'STRIPE',
    label: 'Tarjeta de crédito',
    fallbackFeeBps: 350,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03
  },
  {
    id: 'mercado_pago',
    method: 'MERCADO_PAGO',
    label: 'Mercado Pago',
    fallbackFeeBps: 320,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.05,
    usesLocalCurrency: true
  },
  {
    id: 'pix',
    method: 'LOCAL_RAIL',
    label: 'Pix (Brasil)',
    fallbackFeeBps: 55,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true
  },
  {
    id: 'local_transfer',
    method: 'LOCAL_RAIL',
    label: 'Transferencia bancaria local',
    fallbackFeeBps: 45,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true
  },
  {
    id: 'sepa',
    method: 'LOCAL_RAIL',
    label: 'SEPA (Europa)',
    fallbackFeeBps: 35,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true
  },
  {
    id: 'ach',
    method: 'LOCAL_RAIL',
    label: 'ACH (EE.UU.)',
    fallbackFeeBps: 40,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.02
  },
  {
    id: 'alipay',
    method: 'LOCAL_RAIL',
    label: 'Alipay',
    fallbackFeeBps: 120,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true
  },
  {
    id: 'wechat_pay',
    method: 'LOCAL_RAIL',
    label: 'WeChat Pay',
    fallbackFeeBps: 120,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true
  },
  {
    id: 'wise',
    method: 'BRIDGE',
    label: 'Wise',
    fallbackFeeBps: 95,
    fallbackGasUsd: 0.05,
    fallbackNetworkUsd: 0.04,
    usesLocalCurrency: true
  },
  {
    id: 'electronic_wallet',
    method: 'COINBASE',
    label: 'Billetera electrónica (Coinbase)',
    fallbackFeeBps: 100,
    fallbackGasUsd: 0.04,
    fallbackNetworkUsd: 0.02,
    usesLocalCurrency: true
  },
  {
    id: 'transak',
    method: 'TRANSAK',
    label: 'Transak',
    fallbackFeeBps: 180,
    fallbackGasUsd: 0.08,
    fallbackNetworkUsd: 0.04,
    usesLocalCurrency: true
  },
  {
    id: 'bridge',
    method: 'BRIDGE',
    label: 'Bridge',
    fallbackFeeBps: 80,
    fallbackGasUsd: 0.12,
    fallbackNetworkUsd: 0.05,
    usesLocalCurrency: true
  },
  {
    id: 'ramp',
    method: 'RAMP',
    label: 'Ramp Network',
    fallbackFeeBps: 200,
    fallbackGasUsd: 0.07,
    fallbackNetworkUsd: 0.04,
    usesLocalCurrency: true
  },
  {
    id: 'loan_account',
    method: 'CUSTODIAL_STABLECOIN',
    label: 'Cuenta de préstamo',
    fallbackFeeBps: 40,
    fallbackGasUsd: 0.02,
    fallbackNetworkUsd: 0.01
  }
];

function depositRowConfigured(row: DepositDisplayRow): boolean {
  if (row.id === 'paypal') {
    return Boolean(process.env.PAYPAL_CLIENT_ID ?? process.env.PAYPAL_SECRET);
  }
  if (row.id === 'google_pay') {
    return Boolean(process.env.GOOGLE_PAY_MERCHANT_ID);
  }
  if (row.id === 'apple_pay') {
    return Boolean(process.env.APPLE_PAY_MERCHANT_ID);
  }
  if (row.id === 'pix' || row.id === 'sepa' || row.id === 'ach' || row.id === 'alipay' || row.id === 'wechat_pay') {
    return Boolean(
      process.env.LOCAL_RAILS_ENABLED === 'true' || process.env.DLOCAL_API_KEY || process.env.EBANX_API_KEY
    );
  }
  if (row.id === 'wise') {
    return Boolean(process.env.BRIDGE_API_KEY || process.env.WISE_API_KEY);
  }

  return paymentGatewayConfigured(row.method) || row.method === 'CUSTODIAL_STABLECOIN';
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

function estimateGasUsd(row: DepositDisplayRow): number {
  if (row.method === 'CUSTODIAL_STABLECOIN') {
    return row.fallbackGasUsd;
  }
  if (row.method === 'BRIDGE' || row.method === 'TRANSAK' || row.method === 'RAMP') {
    return row.fallbackGasUsd;
  }
  if (row.method === 'COINBASE') {
    return row.fallbackGasUsd;
  }
  return row.fallbackGasUsd;
}

export function buildDepositPaymentOptions(
  amountUsd: number,
  country = 'AR',
  fxRateUsdToLocal?: number
): DepositQuoteBundle {
  const normalizedAmount = Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : 0;
  const localCurrency = COUNTRY_LOCAL_CURRENCY[country] ?? 'USD';
  const fxRate = fxRateUsdToLocal ?? FALLBACK_FX_USD_TO_LOCAL[localCurrency] ?? 1;
  const quoteExpiresAt = new Date(Date.now() + DEPOSIT_QUOTE_TTL_SECONDS * 1000).toISOString();

  const options = DEPOSIT_DISPLAY_ROWS.map((row) => {
    const configured = depositRowConfigured(row);

    const quotedPlatform = lowestPlatformFeeUsd(row.method, normalizedAmount, country);
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
      method: row.method,
      label: row.label,
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
      stablecoinNetwork: row.stablecoinNetwork
    };
  }).sort((a, b) => a.totalUsd - b.totalUsd);

  return {
    options,
    quoteExpiresAt,
    quoteTtlSeconds: DEPOSIT_QUOTE_TTL_SECONDS,
    baseCurrency: 'USD',
    localCurrency,
    fxRateUsdToLocal: fxRate
  };
}
