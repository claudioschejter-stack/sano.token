/**
 * Public RPC endpoints throttle bursts of `eth_call`, and ethers surfaces the
 * throttled response as `missing revert data` — indistinguishable from a
 * contract that genuinely reverted.
 *
 * An audit that reads dozens of contracts hits this constantly, and without a
 * retry every throttled read looks like its own architectural failure: a Safe
 * that "is not a Safe", an owner that is "unknown". Retrying turns a transient
 * rate limit back into what it is.
 */

const TRANSIENT_PATTERNS = [
  'missing revert data',
  'could not coalesce error',
  'rate limit',
  'too many requests',
  '429',
  'timeout',
  'ETIMEDOUT',
  'ECONNRESET',
  'SERVER_ERROR',
  'bad response',
  'failed to fetch'
];

export function isTransientRpcError(error: unknown): boolean {
  const message = String(
    (error as { shortMessage?: string })?.shortMessage ??
      (error as Error)?.message ??
      error ??
      ''
  ).toLowerCase();
  return TRANSIENT_PATTERNS.some((pattern) => message.includes(pattern.toLowerCase()));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run an on-chain read, retrying transient RPC failures with backoff.
 * Returns `null` when every attempt fails, so callers can tell "no pude leer"
 * apart from a value they can trust.
 */
export async function readWithRetry<T>(
  read: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number }
): Promise<T | null> {
  const attempts = options?.attempts ?? 3;
  const baseDelay = options?.baseDelayMs ?? 250;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (!isTransientRpcError(error) || attempt === attempts - 1) {
        return null;
      }
      await sleep(baseDelay * 2 ** attempt);
    }
  }
  return null;
}
