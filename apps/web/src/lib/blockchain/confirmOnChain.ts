/**
 * Read a value until it reflects a write that already succeeded.
 *
 * A read fired straight after a receipt can land on a node that has not applied
 * that block yet, and the answer is the state from before the write. Treating
 * that as the outcome turns a successful transaction into a reported failure —
 * which is worse than a slow answer, because the caller then retries, refunds,
 * or files it as broken.
 *
 * `confirmed: false` never means the write failed. It means the reads did not
 * catch up in the time allowed, and the caller should say so rather than assert
 * the stale value.
 */
export async function confirmOnChain<T>(input: {
  read: () => Promise<T | null>;
  /** True once the value shows the write. */
  satisfied: (value: T) => boolean;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<{ confirmed: boolean; value: T | null }> {
  const deadline = Date.now() + (input.timeoutMs ?? 15_000);
  const interval = input.intervalMs ?? 1_500;
  let last: T | null = null;

  for (;;) {
    last = await input.read().catch(() => null);
    if (last !== null && input.satisfied(last)) {
      return { confirmed: true, value: last };
    }
    if (Date.now() + interval >= deadline) {
      return { confirmed: false, value: last };
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
