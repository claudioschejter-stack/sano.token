import type { BestBorrowRateResponse } from '../../types/marketplace';
import { readLenderBorrowApyBps, WORLD_LENDERS } from './lendersRegistry';

export async function fetchBestBorrowRate(): Promise<BestBorrowRateResponse | null> {
  const fetchedAt = new Date().toISOString();

  const quotes = WORLD_LENDERS.map((lender) => ({
    id: lender.id,
    name: lender.name,
    protocol: lender.id,
    region: lender.region,
    category: lender.category,
    borrowApyBps: readLenderBorrowApyBps(lender),
    source: lender.envKey ? `${lender.id}-configured` : `${lender.id}-default`,
    fetchedAt
  })).sort((a, b) => a.borrowApyBps - b.borrowApyBps);

  if (quotes.length === 0) {
    return null;
  }

  const best = quotes[0];

  return {
    best: {
      id: best.id,
      name: best.name,
      protocol: best.id,
      borrowApyBps: best.borrowApyBps,
      region: best.region,
      category: best.category,
      source: best.source,
      fetchedAt: best.fetchedAt
    },
    quotes
  };
}
