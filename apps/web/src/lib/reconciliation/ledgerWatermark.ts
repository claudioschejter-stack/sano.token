import { prisma } from '@sanova/database';

/**
 * Where to resume indexing a contract.
 *
 * The indexer used to scan a fixed window back from the tip — about 22 hours of
 * Base blocks against a daily cron. Any run that was skipped or failed left a
 * permanent hole, because nothing ever looked at those blocks again.
 *
 * The ledger is its own cursor: the highest block already recorded for a
 * contract is exactly where the next scan should start. No extra table to keep
 * in sync, and a gap closes itself on the next run instead of persisting.
 */
export async function resolveLedgerStartBlock(input: {
  contractAddress: string;
  latestBlock: number;
  /** Used when the ledger has nothing for this contract yet. */
  fallbackLookback: number;
  /** Ceiling on one run, so a long outage does not produce an unbounded scan. */
  maxSpan: number;
}): Promise<number> {
  const highest = await prisma.tokenMovement
    .findFirst({
      where: { contractAddress: { equals: input.contractAddress, mode: 'insensitive' } },
      orderBy: { blockNumber: 'desc' },
      select: { blockNumber: true }
    })
    .catch(() => null);

  const fromLedger =
    highest?.blockNumber != null ? Number(highest.blockNumber) + 1 : null;

  const fallbackStart = Math.max(0, input.latestBlock - input.fallbackLookback);
  const desired = fromLedger ?? fallbackStart;
  const capped = Math.max(desired, input.latestBlock - input.maxSpan);

  return Math.max(0, Math.min(capped, input.latestBlock));
}
