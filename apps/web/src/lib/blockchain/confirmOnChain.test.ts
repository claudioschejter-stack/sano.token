import { describe, expect, it } from 'vitest';
import { confirmOnChain } from './confirmOnChain';

/**
 * The failure this exists to prevent: a read fired right after a receipt lands
 * on a node that has not applied the block, answers with the state from before
 * the write, and the caller files a successful transaction as broken.
 */
describe('confirmOnChain', () => {
  it('confirms as soon as the read reflects the write', async () => {
    let calls = 0;
    const outcome = await confirmOnChain({
      read: async () => {
        calls += 1;
        return calls;
      },
      satisfied: (value) => value >= 1,
      intervalMs: 1
    });

    expect(outcome).toEqual({ confirmed: true, value: 1 });
    expect(calls).toBe(1);
  });

  it('keeps reading past a stale answer', async () => {
    let calls = 0;
    const outcome = await confirmOnChain({
      // Two nodes behind, then caught up.
      read: async () => (++calls >= 3 ? 'nuevo' : 'viejo'),
      satisfied: (value) => value === 'nuevo',
      timeoutMs: 1_000,
      intervalMs: 1
    });

    expect(outcome.confirmed).toBe(true);
    expect(calls).toBe(3);
  });

  it('reports that it could not confirm instead of asserting the stale value', async () => {
    const outcome = await confirmOnChain({
      read: async () => 'viejo',
      satisfied: (value) => value === 'nuevo',
      timeoutMs: 20,
      intervalMs: 5
    });

    expect(outcome).toEqual({ confirmed: false, value: 'viejo' });
  });

  it('survives a read that throws', async () => {
    let calls = 0;
    const outcome = await confirmOnChain({
      read: async () => {
        if (++calls < 2) throw new Error('RPC 429');
        return 'nuevo';
      },
      satisfied: (value) => value === 'nuevo',
      timeoutMs: 1_000,
      intervalMs: 1
    });

    expect(outcome.confirmed).toBe(true);
  });
});
