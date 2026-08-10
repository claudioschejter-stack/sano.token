import { maskRpcUrl } from './maskRpcUrl';

/**
 * Which Base endpoint the server talks to, in one place.
 *
 * There were three resolvers and about eighty inline
 * `process.env.X || 'https://mainnet.base.org'` fallbacks, each reading a
 * different variable: `resolveChainRpcUrl` only looked at `BASE_RPC_URL`, this
 * module also accepted `LENDING_BASE_RPC_URL`, and the payments one added
 * `NEXT_PUBLIC_BASE_RPC_URL`. So a dedicated endpoint configured under one name
 * left other subsystems silently on the public one.
 *
 * Silently is the problem. `mainnet.base.org` throttles bursts of `eth_call`,
 * ethers reports the throttle as "missing revert data", and the RWA security
 * report read that as a contract answering "no" — inventing allowlist
 * violations and blocking real assets. The endpoint in use is now something the
 * platform can state, not guess.
 */

/** Public endpoints, used only as failover. They rate-limit under load. */
const PUBLIC_BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://1rpc.io/base'
];

const PUBLIC_BASE_RPC_HOSTS = new Set(['mainnet.base.org', 'base.llamarpc.com', '1rpc.io']);

/**
 * Compare hosts, never substrings.
 *
 * `url.includes('alchemy.com')` also matches `https://attacker.example/?x=alchemy.com`
 * and `https://alchemy.com.attacker.example`, so a hostile value could pass
 * itself off as the dedicated provider and suppress the "estás en el RPC
 * público" warning that makes a degraded report actionable.
 */
function rpcHostname(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAlchemyHost(hostname: string | null): boolean {
  return hostname === 'alchemy.com' || (hostname?.endsWith('.alchemy.com') ?? false);
}

export function isPublicBaseRpc(url: string | null | undefined): boolean {
  const hostname = rpcHostname(url);
  // An unset or unparseable endpoint is what degrades to the public one.
  if (!hostname) return true;
  return PUBLIC_BASE_RPC_HOSTS.has(hostname);
}

/**
 * True when the endpoint serves Alchemy's enhanced methods, like
 * `alchemy_getAssetTransfers`. Callers use it to pick a cheaper path and keep the
 * plain-JSON-RPC one as failover, so this must never guess yes.
 */
export function isAlchemyBaseRpc(url: string | null | undefined): boolean {
  return isAlchemyHost(rpcHostname(url));
}

/** Alchemy from a bare key, so one variable is enough to leave the public RPC. */
export function alchemyBaseRpcUrl(): string | null {
  const explicit = process.env.ALCHEMY_BASE_RPC_URL?.trim();
  if (explicit) return explicit;

  const key =
    process.env.ALCHEMY_API_KEY?.trim() ||
    process.env.ALCHEMY_KEY?.trim() ||
    process.env.NEXT_PUBLIC_ALCHEMY_KEY?.trim();
  return key ? `https://base-mainnet.g.alchemy.com/v2/${key}` : null;
}

export function resolveBaseMainnetRpcUrls(): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const pick of [
    () => process.env.LENDING_BASE_RPC_URL?.trim(),
    () => process.env.BASE_RPC_URL?.trim(),
    () => process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim(),
    () => process.env.BLOCKCHAIN_RPC_URL?.trim(),
    alchemyBaseRpcUrl,
    ...PUBLIC_BASE_RPCS.map((url) => () => url)
  ]) {
    const url = pick();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push(url);
  }

  /**
   * A dedicated endpoint wins over a public one no matter which variable it came
   * from. `scripts/vercel/sync-lending-env.mjs` writes
   * `LENDING_BASE_RPC_URL=https://mainnet.base.org` when nothing is set, and that
   * variable is read first — so adding an Alchemy key would have been a silent
   * no-op, which is the same class of failure this module exists to remove. A
   * configured public URL is a leftover default, not a preference.
   */
  return [
    ...candidates.filter((url) => !isPublicBaseRpc(url)),
    ...candidates.filter((url) => isPublicBaseRpc(url))
  ];
}

export function resolveBaseMainnetRpcUrl(): string {
  return resolveBaseMainnetRpcUrls()[0] ?? PUBLIC_BASE_RPCS[0];
}

/** True when reads go to an endpoint we pay for rather than a shared public one. */
export function baseRpcIsDedicated(): boolean {
  return !isPublicBaseRpc(resolveBaseMainnetRpcUrl());
}

export type BaseRpcDescription = {
  provider: 'alchemy' | 'configured' | 'public';
  /** Masked: provider keys live in the URL path or query. */
  url: string | null;
  dedicated: boolean;
  failoverCount: number;
};

export function describeBaseRpc(): BaseRpcDescription {
  const urls = resolveBaseMainnetRpcUrls();
  const primary = urls[0] ?? PUBLIC_BASE_RPCS[0];
  const dedicated = !isPublicBaseRpc(primary);

  return {
    provider: isAlchemyHost(rpcHostname(primary)) ? 'alchemy' : dedicated ? 'configured' : 'public',
    url: maskRpcUrl(primary),
    dedicated,
    failoverCount: Math.max(0, urls.length - 1)
  };
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

export async function withBaseMainnetRpc<T>(run: (rpcUrl: string) => Promise<T>): Promise<T> {
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
