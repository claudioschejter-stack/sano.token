/**
 * Run a job over a list with a bounded number in flight.
 *
 * Serial `for (const x of xs) await f(x)` is the default shape in this codebase,
 * and for anything that reads the chain it means the run grows linearly with the
 * data — inside functions Vercel stops at 300 seconds. Unbounded `Promise.all`
 * trades that for a burst the RPC answers with `missing revert data`, which the
 * platform then mistakes for a contract reverting.
 *
 * A window is the middle: overlap the waiting, keep the burst small.
 */

export type SettledResult<T, R> =
  | { item: T; ok: true; value: R }
  | { item: T; ok: false; error: unknown };

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  job: (item: T, index: number) => Promise<R>
): Promise<Array<SettledResult<T, R>>> {
  const width = Math.max(1, Math.trunc(concurrency));
  const out: Array<SettledResult<T, R>> = [];

  for (let start = 0; start < items.length; start += width) {
    const window = items.slice(start, start + width);
    const settled = await Promise.allSettled(
      window.map((item, offset) => job(item, start + offset))
    );

    for (const [offset, result] of settled.entries()) {
      const item = window[offset];
      if (result.status === 'fulfilled') {
        out.push({ item, ok: true, value: result.value });
      } else {
        // One failure must not abandon the rest of the list, which is what a
        // serial loop did: it threw and everything after it went unprocessed.
        out.push({ item, ok: false, error: result.reason });
      }
    }
  }

  return out;
}

/** The values that succeeded, in input order. */
export function successes<T, R>(results: Array<SettledResult<T, R>>): R[] {
  return results.filter((row): row is { item: T; ok: true; value: R } => row.ok).map((row) => row.value);
}

export function failures<T, R>(results: Array<SettledResult<T, R>>): Array<{ item: T; error: unknown }> {
  return results
    .filter((row): row is { item: T; ok: false; error: unknown } => !row.ok)
    .map((row) => ({ item: row.item, error: row.error }));
}
