import type { LenderDefinition } from './lendersRegistry';

/** DefiLlama `project` slugs used in yields.llama.fi/pools */
export const DEFILLAMA_PROJECTS_BY_LENDER: Record<string, string[]> = {
  aave: ['aave-v3'],
  aave_horizon: ['aave-v3'],
  compound: ['compound-v3'],
  sky: ['makerdao', 'sky-lending'],
  morpho: ['morpho-v1', 'morpho-blue'],
  spark: ['spark'],
  euler: ['euler-v2', 'euler'],
  radiant: ['radiant-v2', 'radiant'],
  maple: ['maple'],
  clearpool: ['clearpool'],
  centrifuge: ['centrifuge'],
  goldfinch: ['goldfinch'],
  truefi: ['truefi'],
  ondo: ['ondo'],
  figure: ['figure'],
  liquity: ['liquity'],
  venus: ['venus'],
  benqi: ['benqi'],
  kamino: ['kamino'],
  frax: ['frax'],
  dydx: ['dydx']
};

/** Prefer these chains when multiple pools exist for a lender. */
export const PREFERRED_BORROW_CHAINS = ['Base', 'Ethereum', 'Arbitrum', 'Polygon', 'Optimism'];

export type DefiLlamaPool = {
  chain: string;
  project: string;
  symbol?: string;
  apyBaseBorrow?: number | null;
  apyRewardBorrow?: number | null;
};

export function apyPercentToBps(apyPercent: number): number {
  return Math.max(0, Math.round(apyPercent * 100));
}

export function poolBorrowApyBps(pool: DefiLlamaPool): number | null {
  const base = pool.apyBaseBorrow ?? 0;
  const reward = pool.apyRewardBorrow ?? 0;
  const total = base + reward;
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  return apyPercentToBps(total);
}

export function chainPriority(chain: string): number {
  const index = PREFERRED_BORROW_CHAINS.findIndex(
    (preferred) => preferred.toLowerCase() === chain.toLowerCase()
  );
  return index === -1 ? PREFERRED_BORROW_CHAINS.length : index;
}

export function matchLenderPool(
  lender: LenderDefinition,
  pools: DefiLlamaPool[]
): DefiLlamaPool | null {
  const projects = DEFILLAMA_PROJECTS_BY_LENDER[lender.id];
  if (!projects?.length) {
    return null;
  }

  const matches = pools.filter(
    (pool) =>
      projects.includes(pool.project) &&
      poolBorrowApyBps(pool) != null &&
      PREFERRED_BORROW_CHAINS.some((chain) => chain.toLowerCase() === pool.chain.toLowerCase())
  );

  if (matches.length === 0) {
    return null;
  }

  matches.sort((a, b) => {
    const chainDiff = chainPriority(a.chain) - chainPriority(b.chain);
    if (chainDiff !== 0) {
      return chainDiff;
    }
    return (poolBorrowApyBps(a) ?? Number.MAX_SAFE_INTEGER) - (poolBorrowApyBps(b) ?? Number.MAX_SAFE_INTEGER);
  });

  return matches[0];
}
