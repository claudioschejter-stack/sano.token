const PUBLIC_BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://1rpc.io/base'
];

export function resolveBaseMainnetRpcUrls(): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const pick of [
    () => process.env.LENDING_BASE_RPC_URL?.trim(),
    () => process.env.BASE_RPC_URL?.trim(),
    () => process.env.BLOCKCHAIN_RPC_URL?.trim(),
    ...PUBLIC_BASE_RPCS.map((url) => () => url)
  ]) {
    const url = pick();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}

export function resolveBaseMainnetRpcUrl(): string {
  return resolveBaseMainnetRpcUrls()[0] ?? PUBLIC_BASE_RPCS[0];
}

function isRetryableRpcError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const info = (error as { info?: { error?: { code?: number; message?: string } } }).info;
  const message = String((error as { message?: string }).message ?? '');
  return (
    info?.error?.code === -32016 ||
    /rate limit/i.test(info?.error?.message ?? '') ||
    /rate limit/i.test(message) ||
    /missing revert data/i.test(message)
  );
}

export async function withBaseMainnetRpc<T>(
  run: (rpcUrl: string) => Promise<T>
): Promise<T> {
  const urls = resolveBaseMainnetRpcUrls();
  let lastError: unknown;

  for (const rpcUrl of urls) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await run(rpcUrl);
      } catch (error) {
        lastError = error;
        if (!isRetryableRpcError(error) || attempt >= 2) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Base RPC unavailable');
}
