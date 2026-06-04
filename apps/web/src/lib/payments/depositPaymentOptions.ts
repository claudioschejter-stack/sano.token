import type { PaymentMethod } from '@sanova/database';
import { quoteCheapestPaymentRoutes } from './cheapestPaymentRouter';
import { paymentGatewayConfigured } from './paymentConfig';

export type DepositPaymentOption = {
  id: string;
  method: PaymentMethod;
  label: string;
  feeUsd: number;
  feeBps: number;
  totalUsd: number;
  configured: boolean;
  stablecoinNetwork?: string;
};

type DepositDisplayRow = {
  id: string;
  method: PaymentMethod;
  label: string;
  fallbackFeeBps: number;
  stablecoinNetwork?: string;
  alwaysAvailable?: boolean;
};

const DEPOSIT_DISPLAY_ROWS: DepositDisplayRow[] = [
  {
    id: 'own_wallet',
    method: 'USDC_ONCHAIN',
    label: 'Cartera propia',
    fallbackFeeBps: 30,
    stablecoinNetwork: 'BASE',
    alwaysAvailable: true
  },
  {
    id: 'electronic_wallet',
    method: 'COINBASE',
    label: 'Billetera electrónica',
    fallbackFeeBps: 100
  },
  {
    id: 'mercado_pago',
    method: 'MERCADO_PAGO',
    label: 'Mercado Pago',
    fallbackFeeBps: 320
  },
  {
    id: 'debit_card',
    method: 'STRIPE',
    label: 'Tarjeta de débito',
    fallbackFeeBps: 250
  },
  {
    id: 'credit_card',
    method: 'STRIPE',
    label: 'Tarjeta de crédito',
    fallbackFeeBps: 350
  },
  {
    id: 'local_transfer',
    method: 'LOCAL_RAIL',
    label: 'Transferencia bancaria local',
    fallbackFeeBps: 45
  },
  {
    id: 'transak',
    method: 'TRANSAK',
    label: 'Transak',
    fallbackFeeBps: 180
  },
  {
    id: 'bridge',
    method: 'BRIDGE',
    label: 'Bridge',
    fallbackFeeBps: 80
  },
  {
    id: 'ramp',
    method: 'RAMP',
    label: 'Ramp Network',
    fallbackFeeBps: 200
  },
  {
    id: 'custodial',
    method: 'CUSTODIAL_STABLECOIN',
    label: 'Stablecoin custodial',
    fallbackFeeBps: 40
  }
];

function lowestFeeUsdForMethod(
  method: PaymentMethod,
  amountUsd: number,
  country: string
): number | null {
  const quotes = quoteCheapestPaymentRoutes({
    amountUsd,
    country,
    direction: 'FIAT_TO_BALANCE'
  });

  const match = quotes.find((quote) => quote.method === method);
  return match?.estimatedFeeUsd ?? null;
}

export function buildDepositPaymentOptions(
  amountUsd: number,
  country = 'AR'
): DepositPaymentOption[] {
  const normalizedAmount = Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : 0;

  return DEPOSIT_DISPLAY_ROWS.map((row) => {
    const configured =
      row.alwaysAvailable === true ||
      row.method === 'USDC_ONCHAIN' ||
      paymentGatewayConfigured(row.method);

    const quotedFee = lowestFeeUsdForMethod(row.method, normalizedAmount, country);
    const feeUsd =
      quotedFee ??
      (row.id === 'credit_card' && row.method === 'STRIPE'
        ? (normalizedAmount * row.fallbackFeeBps) / 10_000
        : row.id === 'debit_card' && row.method === 'STRIPE'
          ? (normalizedAmount * 250) / 10_000
          : (normalizedAmount * row.fallbackFeeBps) / 10_000);

    const feeBps =
      normalizedAmount > 0 ? Math.round((feeUsd / normalizedAmount) * 10_000) : row.fallbackFeeBps;

    return {
      id: row.id,
      method: row.method,
      label: row.label,
      feeUsd,
      feeBps,
      totalUsd: normalizedAmount + feeUsd,
      configured,
      stablecoinNetwork: row.stablecoinNetwork
    };
  })
    .filter((row) => row.configured)
    .sort((a, b) => a.feeUsd - b.feeUsd);
}
