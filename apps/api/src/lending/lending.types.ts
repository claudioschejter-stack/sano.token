export type LendingProtocolId = 'aave' | 'compound' | 'maker';

export type BorrowRateQuote = Readonly<{
  protocol: LendingProtocolId;
  borrowApyBps: number;
  source: string;
  fetchedAt: string;
}>;

export type BestBorrowRateResult = Readonly<{
  best: BorrowRateQuote;
  quotes: BorrowRateQuote[];
}>;
