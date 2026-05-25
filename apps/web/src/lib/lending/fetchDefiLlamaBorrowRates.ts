import {
  apyPercentToBps,
  type DefiLlamaPool,
  matchLenderPool,
  poolBorrowApyBps
} from './defillamaMapping';
import type { LenderDefinition } from './lendersRegistry';

const DEFILLAMA_POOLS_URL = 'https://yields.llama.fi/pools';

let poolsCache: { fetchedAt: number; pools: DefiLlamaPool[] } | null = null;

async function loadDefiLlamaPools(): Promise<DefiLlamaPool[]> {
  if (poolsCache && Date.now() - poolsCache.fetchedAt < 10 * 60 * 1000) {
    return poolsCache.pools;
  }

  const response = await fetch(DEFILLAMA_POOLS_URL, {
    next: { revalidate: 600 }
  });

  if (!response.ok) {
    throw new Error(`DefiLlama pools HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { data?: DefiLlamaPool[] } | DefiLlamaPool[];
  const pools = Array.isArray(payload) ? payload : (payload.data ?? []);
  poolsCache = { fetchedAt: Date.now(), pools };
  return pools;
}

export type DefiLlamaBorrowQuote = {
  lenderId: string;
  borrowApyBps: number;
  source: string;
  chain: string;
  project: string;
  symbol?: string;
};

export async function fetchDefiLlamaBorrowQuotes(
  lenders: LenderDefinition[]
): Promise<Map<string, DefiLlamaBorrowQuote>> {
  const pools = await loadDefiLlamaPools();
  const quotes = new Map<string, DefiLlamaBorrowQuote>();

  for (const lender of lenders) {
    const pool = matchLenderPool(lender, pools);
    if (!pool) {
      continue;
    }

    const borrowApyBps = poolBorrowApyBps(pool);
    if (borrowApyBps == null) {
      continue;
    }

    quotes.set(lender.id, {
      lenderId: lender.id,
      borrowApyBps,
      source: `defillama:${pool.project}:${pool.chain.toLowerCase()}`,
      chain: pool.chain,
      project: pool.project,
      symbol: pool.symbol
    });
  }

  return quotes;
}

export function rayToApyBps(rayRate: bigint): number {
  if (rayRate <= 0n) {
    return 0;
  }

  const ratePerSecond = Number(rayRate) / 1e27;
  const apyPercent = (Math.pow(1 + ratePerSecond, 31_536_000) - 1) * 100;
  return Math.max(0, Math.round(apyPercent * 100));
}
