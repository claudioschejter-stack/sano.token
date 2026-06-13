/** On-chain borrow rate reads — Morpho APY is sourced from DefiLlama / env overrides. */
export type OnChainBorrowQuote = {
  lenderId: string;
  borrowApyBps: number;
  source: string;
  chainId: number;
};

export async function fetchOnChainBorrowQuotes(): Promise<Map<string, OnChainBorrowQuote>> {
  return new Map();
}
