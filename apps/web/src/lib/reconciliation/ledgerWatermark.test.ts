import { beforeEach, describe, expect, it, vi } from 'vitest';

let highest: { blockNumber: number } | null = null;
let findFirstThrows = false;

vi.mock('@sanova/database', () => ({
  prisma: {
    tokenMovement: {
      findFirst: async () => {
        if (findFirstThrows) throw new Error('db down');
        return highest;
      }
    }
  }
}));

const { resolveLedgerStartBlock } = await import('./ledgerWatermark');

const CONTRACT = '0x1234567890123456789012345678901234567890';

beforeEach(() => {
  highest = null;
  findFirstThrows = false;
});

describe('resolveLedgerStartBlock', () => {
  it('resumes one block after what the ledger already holds', async () => {
    highest = { blockNumber: 1_000_000 };
    const start = await resolveLedgerStartBlock({
      contractAddress: CONTRACT,
      latestBlock: 1_010_000,
      fallbackLookback: 100,
      maxSpan: 400_000
    });
    expect(start).toBe(1_000_001);
  });

  it('closes a gap left by a run that never happened', async () => {
    // The ledger stopped 50k blocks ago; a fixed 100-block lookback would skip them.
    highest = { blockNumber: 960_000 };
    const start = await resolveLedgerStartBlock({
      contractAddress: CONTRACT,
      latestBlock: 1_010_000,
      fallbackLookback: 100,
      maxSpan: 400_000
    });
    expect(start).toBe(960_001);
  });

  it('uses the fallback window when the ledger is empty', async () => {
    const start = await resolveLedgerStartBlock({
      contractAddress: CONTRACT,
      latestBlock: 1_010_000,
      fallbackLookback: 40_000,
      maxSpan: 400_000
    });
    expect(start).toBe(970_000);
  });

  it('caps one run so a long outage cannot produce an unbounded scan', async () => {
    highest = { blockNumber: 1 };
    const start = await resolveLedgerStartBlock({
      contractAddress: CONTRACT,
      latestBlock: 5_000_000,
      fallbackLookback: 40_000,
      maxSpan: 400_000
    });
    expect(start).toBe(4_600_000);
  });

  it('never returns a block past the tip', async () => {
    highest = { blockNumber: 1_010_000 };
    const start = await resolveLedgerStartBlock({
      contractAddress: CONTRACT,
      latestBlock: 1_010_000,
      fallbackLookback: 100,
      maxSpan: 400_000
    });
    expect(start).toBe(1_010_000);
  });

  it('falls back to the window when the ledger cannot be read', async () => {
    findFirstThrows = true;
    const start = await resolveLedgerStartBlock({
      contractAddress: CONTRACT,
      latestBlock: 1_010_000,
      fallbackLookback: 1_000,
      maxSpan: 400_000
    });
    expect(start).toBe(1_009_000);
  });
});
