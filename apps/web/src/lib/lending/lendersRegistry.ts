export type LenderRegion = 'global' | 'americas' | 'europe' | 'asia_pacific' | 'mea';

export type LenderCategory = 'money_market' | 'credit_pool' | 'rwa' | 'institutional';

export type LenderDefinition = {
  id: string;
  name: string;
  region: LenderRegion;
  category: LenderCategory;
  /** Optional env override, e.g. AAVE_BORROW_APY_BPS */
  envKey?: string;
  defaultBorrowApyBps: number;
};

/** Worldwide lending protocols aggregated for Sanova RWA (Morpho on Base only). */
export const WORLD_LENDERS: LenderDefinition[] = [
  {
    id: 'morpho',
    name: 'Morpho',
    region: 'global',
    category: 'money_market',
    envKey: 'MORPHO_BORROW_APY_BPS',
    defaultBorrowApyBps: 451
  }
];

export function readLenderBorrowApyBps(lender: LenderDefinition): number {
  if (lender.envKey) {
    const fromEnv = Number(process.env[lender.envKey]);
    if (Number.isFinite(fromEnv) && fromEnv > 0) {
      return fromEnv;
    }
  }

  return lender.defaultBorrowApyBps;
}
