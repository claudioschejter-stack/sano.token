import type { YieldConversionRail } from '@sanova/database';

export type YieldConversionQuote = {
  rail: YieldConversionRail;
  label: string;
  estimatedFeeBps: number;
  reason: string;
};

const FX_USD_PER_ARS = Number(process.env.YIELD_FX_USD_PER_ARS ?? '1000');

export function normalizeOperatingCurrency(currency?: string | null): string {
  const value = currency?.trim().toUpperCase();
  if (!value) return 'USD';
  if (value === 'USDC') return 'USD';
  return value;
}

export function operatingAmountToUsd(amount: number, currency: string): number {
  const normalized = normalizeOperatingCurrency(currency);
  if (normalized === 'USD') return amount;
  if (normalized === 'ARS') return FX_USD_PER_ARS > 0 ? amount / FX_USD_PER_ARS : amount;
  return amount;
}

export function chooseYieldConversionRail(currency: string): YieldConversionQuote {
  const normalized = normalizeOperatingCurrency(currency);

  if (normalized === 'USD') {
    if (process.env.BRIDGE_API_KEY?.trim()) {
      return {
        rail: 'BRIDGE',
        label: 'Bridge.xyz',
        estimatedFeeBps: 80,
        reason: 'On-ramp B2B USD más económico con volumen'
      };
    }
    if (process.env.COINBASE_ADVANCED_TRADE_API_KEY?.trim()) {
      return {
        rail: 'COINBASE',
        label: 'Coinbase Advanced Trade',
        estimatedFeeBps: 100,
        reason: 'USD → USDC vía Coinbase API'
      };
    }
    return {
      rail: 'MANUAL_USDC',
      label: 'USDC manual',
      estimatedFeeBps: 0,
      reason: 'Registrar USDC ya convertido off-platform'
    };
  }

  if (normalized === 'ARS') {
    return {
      rail: 'EXCHANGE',
      label: 'Exchange ARS → USDC',
      estimatedFeeBps: 150,
      reason: 'Batch vía exchange local; confirmación por webhook yield-conversion'
    };
  }

  return {
    rail: 'MANUAL_USDC',
    label: 'USDC manual',
    estimatedFeeBps: 0,
    reason: `Moneda ${normalized}: acreditar USDC convertido manualmente`
  };
}

export function yieldConversionMinUsd(currency: string): number {
  const normalized = normalizeOperatingCurrency(currency);
  if (normalized === 'ARS') {
    const raw = Number(process.env.YIELD_CONVERSION_MIN_ARS ?? '500000');
    return operatingAmountToUsd(Number.isFinite(raw) ? raw : 500_000, 'ARS');
  }
  const raw = Number(process.env.YIELD_CONVERSION_MIN_USD ?? '500');
  return Number.isFinite(raw) && raw > 0 ? raw : 500;
}
