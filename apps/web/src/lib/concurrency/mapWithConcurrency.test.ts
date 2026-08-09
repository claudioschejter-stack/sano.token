import { describe, expect, it } from 'vitest';
import { failures, mapWithConcurrency, successes } from './mapWithConcurrency';

/** Tracks how many jobs were running at the same time. */
function tracker() {
  const state = { inFlight: 0, peak: 0, started: [] as number[] };
  return {
    state,
    job: async (item: number) => {
      state.inFlight += 1;
      state.peak = Math.max(state.peak, state.inFlight);
      state.started.push(item);
      await new Promise((resolve) => setTimeout(resolve, 5));
      state.inFlight -= 1;
      return item * 2;
    }
  };
}

describe('mapWithConcurrency', () => {
  it('overlaps jobs instead of running them one at a time', async () => {
    const { state, job } = tracker();

    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 3, job);

    expect(state.peak).toBe(3);
    expect(successes(results)).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it('never exceeds the window, so a burst cannot throttle the RPC', async () => {
    const { state, job } = tracker();

    await mapWithConcurrency(Array.from({ length: 40 }, (_, i) => i), 8, job);

    expect(state.peak).toBeLessThanOrEqual(8);
  });

  it('keeps going after a failure instead of abandoning the rest', async () => {
    const seen: number[] = [];
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      seen.push(item);
      if (item === 2 || item === 4) throw new Error(`boom ${item}`);
      return item;
    });

    expect(seen).toEqual([1, 2, 3, 4, 5]);
    expect(successes(results)).toEqual([1, 3, 5]);
    expect(failures(results).map((row) => row.item)).toEqual([2, 4]);
  });

  it('preserves input order even when jobs finish out of order', async () => {
    const results = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });

    expect(successes(results)).toEqual([30, 10, 20]);
  });

  it('reports which item failed, not just that something did', async () => {
    const results = await mapWithConcurrency(['a', 'b'], 2, async (item) => {
      if (item === 'b') throw new Error('no');
      return item;
    });

    expect(failures(results)).toHaveLength(1);
    expect(failures(results)[0].item).toBe('b');
  });

  it('does nothing with an empty list', async () => {
    const { state, job } = tracker();
    expect(await mapWithConcurrency([], 4, job)).toEqual([]);
    expect(state.started).toEqual([]);
  });

  it('treats a nonsensical width as one rather than dividing by zero', async () => {
    const { state, job } = tracker();
    await mapWithConcurrency([1, 2, 3], 0, job);
    expect(state.peak).toBe(1);
  });
});
