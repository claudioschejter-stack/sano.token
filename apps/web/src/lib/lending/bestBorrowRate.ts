import type { BestBorrowRateResponse } from '../../types/marketplace';

type BorrowRateQuote = BestBorrowRateResponse['quotes'][number] & {
  source: string;
  fetchedAt: string;
};

function readBps(envKey: string, fallback: number): BorrowRateQuote {
  const borrowApyBps = Number(process.env[envKey] ?? fallback);

  return {
    protocol: envKey.split('_')[0].toLowerCase(),
    borrowApyBps,
    source: `${envKey.split('_')[0].toLowerCase()}-configured`,
    fetchedAt: new Date().toISOString()
  };
}

export async function fetchBestBorrowRate(): Promise<BestBorrowRateResponse | null> {
  const quotes: BorrowRateQuote[] = [
    { ...readBps('AAVE_BORROW_APY_BPS', 485), protocol: 'aave' },
    { ...readBps('COMPOUND_BORROW_APY_BPS', 512), protocol: 'compound' },
    { ...readBps('MAKER_BORROW_APY_BPS', 438), protocol: 'maker' }
  ];

  const best = quotes.reduce((current, candidate) =>
    candidate.borrowApyBps < current.borrowApyBps ? candidate : current
  );

  return {
    best: {
      protocol: best.protocol,
      borrowApyBps: best.borrowApyBps,
      source: best.source,
      fetchedAt: best.fetchedAt
    },
    quotes: quotes.map(({ protocol, borrowApyBps }) => ({ protocol, borrowApyBps }))
  };
}
