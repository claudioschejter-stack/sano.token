import type { BestBorrowRateResponse } from '../../types/marketplace';
import { readBorrowRatesCache, writeBorrowRatesCache } from './borrowRatesCache';
import { fetchDefiLlamaBorrowQuotes } from './fetchDefiLlamaBorrowRates';
import { fetchOnChainBorrowQuotes } from './fetchOnChainBorrowRates';
import { readLenderBorrowApyBps, WORLD_LENDERS } from './lendersRegistry';

type FetchLiveBorrowRatesOptions = {
  forceRefresh?: boolean;
};

function pickSource(
  lenderId: string,
  defiLlama: Map<string, { borrowApyBps: number; source: string }>,
  onChain: Map<string, { borrowApyBps: number; source: string }>,
  fallbackBps: number
): { borrowApyBps: number; source: string; live: boolean } {
  const envOverride = WORLD_LENDERS.find((l) => l.id === lenderId)?.envKey;
  if (envOverride) {
    const fromEnv = Number(process.env[envOverride]);
    if (Number.isFinite(fromEnv) && fromEnv > 0) {
      return { borrowApyBps: fromEnv, source: `${lenderId}-env`, live: false };
    }
  }

  const chainQuote = onChain.get(lenderId);
  const llamaQuote = defiLlama.get(lenderId);

  if (chainQuote && llamaQuote) {
    if (chainQuote.borrowApyBps <= llamaQuote.borrowApyBps) {
      return { borrowApyBps: chainQuote.borrowApyBps, source: chainQuote.source, live: true };
    }
    return { borrowApyBps: llamaQuote.borrowApyBps, source: llamaQuote.source, live: true };
  }

  if (chainQuote) {
    return { borrowApyBps: chainQuote.borrowApyBps, source: chainQuote.source, live: true };
  }

  if (llamaQuote) {
    return { borrowApyBps: llamaQuote.borrowApyBps, source: llamaQuote.source, live: true };
  }

  return { borrowApyBps: fallbackBps, source: `${lenderId}-default`, live: false };
}

export async function fetchLiveBorrowRates(
  options: FetchLiveBorrowRatesOptions = {}
): Promise<BestBorrowRateResponse> {
  if (!options.forceRefresh) {
    const cached = readBorrowRatesCache();
    if (cached) {
      return cached;
    }
  }

  const fetchedAt = new Date().toISOString();
  const [defiLlama, onChain] = await Promise.all([
    fetchDefiLlamaBorrowQuotes(WORLD_LENDERS).catch((error) => {
      console.warn('[lending] DefiLlama fetch failed', error);
      return new Map();
    }),
    fetchOnChainBorrowQuotes().catch((error) => {
      console.warn('[lending] On-chain fetch failed', error);
      return new Map();
    })
  ]);

  const quotes = WORLD_LENDERS.map((lender) => {
    const fallbackBps = readLenderBorrowApyBps(lender);
    const picked = pickSource(lender.id, defiLlama, onChain, fallbackBps);

    return {
      id: lender.id,
      name: lender.name,
      protocol: lender.id,
      region: lender.region,
      category: lender.category,
      borrowApyBps: picked.borrowApyBps,
      source: picked.source,
      fetchedAt
    };
  }).sort((a, b) => a.borrowApyBps - b.borrowApyBps);

  const liveCount = quotes.filter((quote) => !quote.source.endsWith('-default')).length;
  const result: BestBorrowRateResponse = {
    best: {
      ...quotes[0],
      source: quotes[0].source,
      fetchedAt
    },
    quotes,
    meta: {
      liveCount,
      totalCount: quotes.length,
      dataSource: liveCount > 0 ? 'live' : 'fallback'
    }
  };

  writeBorrowRatesCache(result);
  return result;
}

export async function refreshBorrowRatesCache(): Promise<BestBorrowRateResponse> {
  return fetchLiveBorrowRates({ forceRefresh: true });
}
