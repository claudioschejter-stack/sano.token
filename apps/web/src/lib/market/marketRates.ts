/**
 * Free market-rate helpers for Sanova balances and checkout.
 *
 * Sources (no API key):
 * - Fiat FX: https://open.er-api.com/v6/latest/USD (ExchangeRate-API open access)
 * - USDC / stablecoins: treated as 1.00 USD (Base USDC is USD-pegged)
 *
 * Optional later (still free tiers): CoinGecko `/api/v3/simple/price` for non-stable cryptos.
 */

export type MarketRatesSnapshot = {
  base: 'USD';
  fetchedAt: string;
  fiatUsdRates: Record<string, number>;
  /** Crypto symbol → USD price. Stables pinned at 1. */
  cryptoUsdPrices: Record<string, number>;
};

const FALLBACK_FIAT: Record<string, number> = {
  USD: 1,
  ARS: 1050,
  EUR: 0.92,
  BRL: 5.1,
  MXN: 17.2
};

const STABLE_USD: Record<string, number> = {
  USDC: 1,
  USDT: 1,
  DAI: 1,
  USD: 1
};

export async function fetchMarketRatesSnapshot(): Promise<MarketRatesSnapshot> {
  let fiatUsdRates = { ...FALLBACK_FIAT };

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 300 }
    } as RequestInit);
    if (response.ok) {
      const payload = (await response.json()) as { rates?: Record<string, number> };
      if (payload.rates) {
        fiatUsdRates = { USD: 1, ...payload.rates };
      }
    }
  } catch {
    /* keep fallback */
  }

  return {
    base: 'USD',
    fetchedAt: new Date().toISOString(),
    fiatUsdRates,
    cryptoUsdPrices: { ...STABLE_USD }
  };
}

/** Convert an amount in `fromCurrency` into USD using the snapshot. */
export function toUsd(
  amount: number,
  fromCurrency: string,
  rates: MarketRatesSnapshot
): number {
  if (!Number.isFinite(amount)) return 0;
  const code = fromCurrency.trim().toUpperCase();
  if (code === 'USD' || code === 'USDC' || code === 'USDT' || code === 'DAI') {
    return amount * (rates.cryptoUsdPrices[code] ?? 1);
  }
  const fx = rates.fiatUsdRates[code];
  if (!fx || fx <= 0) return amount;
  // rates are "1 USD = fx LOCAL", so LOCAL → USD = amount / fx
  return amount / fx;
}
