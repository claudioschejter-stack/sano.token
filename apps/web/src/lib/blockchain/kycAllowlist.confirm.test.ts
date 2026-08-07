import { describe, expect, it } from 'vitest';
import { confirmOnChain } from './confirmOnChain';

/**
 * The allowlist used to read `kycApproved` once, immediately after the receipt.
 * These cover the two outcomes that read has, so a lagging node stops being
 * reported as an investor who was never approved.
 */
describe('allowlist confirmation after a lagging read', () => {
  it('confirms once the node catches up, instead of failing on the first stale read', async () => {
    let reads = 0;
    const outcome = await confirmOnChain({
      // The first read predates the block: the write already succeeded on chain.
      read: async () => {
        reads += 1;
        return reads > 2;
      },
      satisfied: (value) => value === true,
      intervalMs: 1,
      timeoutMs: 500
    });

    expect(outcome.confirmed).toBe(true);
    expect(reads).toBeGreaterThan(1);
  });

  it('reports the stale value rather than asserting it, when reads never catch up', async () => {
    const outcome = await confirmOnChain({
      read: async () => false,
      satisfied: (value) => value === true,
      intervalMs: 1,
      timeoutMs: 20
    });

    expect(outcome.confirmed).toBe(false);
    expect(outcome.value).toBe(false);
  });

  it('treats a revocation as confirmed only when the read shows it revoked', async () => {
    let approved = true;
    const outcome = await confirmOnChain({
      read: async () => {
        const current = approved;
        approved = false;
        return current;
      },
      satisfied: (value) => value === false,
      intervalMs: 1,
      timeoutMs: 500
    });

    expect(outcome.confirmed).toBe(true);
    expect(outcome.value).toBe(false);
  });
});
