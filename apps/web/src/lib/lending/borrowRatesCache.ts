import type { BestBorrowRateResponse } from '../../types/marketplace';

type CacheEntry = {
  value: BestBorrowRateResponse;
  expiresAt: number;
};

const globalStore = globalThis as typeof globalThis & {
  __sanovaBorrowRatesCache?: CacheEntry;
};

function ttlMs(): number {
  const minutes = Number(process.env.LENDING_RATES_CACHE_TTL_MINUTES ?? '15');
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 15 * 60 * 1000;
  }
  return minutes * 60 * 1000;
}

export function readBorrowRatesCache(): BestBorrowRateResponse | null {
  const entry = globalStore.__sanovaBorrowRatesCache;
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    globalStore.__sanovaBorrowRatesCache = undefined;
    return null;
  }
  return entry.value;
}

export function writeBorrowRatesCache(value: BestBorrowRateResponse): void {
  globalStore.__sanovaBorrowRatesCache = {
    value,
    expiresAt: Date.now() + ttlMs()
  };
}

export function clearBorrowRatesCache(): void {
  globalStore.__sanovaBorrowRatesCache = undefined;
}
