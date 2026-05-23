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

/** Worldwide lending protocols and institutional pools aggregated for Sanova RWA. */
export const WORLD_LENDERS: LenderDefinition[] = [
  { id: 'aave', name: 'Aave v3', region: 'global', category: 'money_market', envKey: 'AAVE_BORROW_APY_BPS', defaultBorrowApyBps: 485 },
  { id: 'aave_horizon', name: 'Aave Horizon (RWA)', region: 'global', category: 'rwa', envKey: 'AAVE_HORIZON_BORROW_APY_BPS', defaultBorrowApyBps: 462 },
  { id: 'compound', name: 'Compound v3', region: 'global', category: 'money_market', envKey: 'COMPOUND_BORROW_APY_BPS', defaultBorrowApyBps: 512 },
  { id: 'sky', name: 'Sky (MakerDAO)', region: 'global', category: 'money_market', envKey: 'MAKER_BORROW_APY_BPS', defaultBorrowApyBps: 438 },
  { id: 'morpho', name: 'Morpho', region: 'global', category: 'money_market', envKey: 'MORPHO_BORROW_APY_BPS', defaultBorrowApyBps: 451 },
  { id: 'spark', name: 'Spark Protocol', region: 'global', category: 'money_market', envKey: 'SPARK_BORROW_APY_BPS', defaultBorrowApyBps: 469 },
  { id: 'euler', name: 'Euler Finance', region: 'global', category: 'money_market', envKey: 'EULER_BORROW_APY_BPS', defaultBorrowApyBps: 528 },
  { id: 'radiant', name: 'Radiant Capital', region: 'global', category: 'money_market', envKey: 'RADIANT_BORROW_APY_BPS', defaultBorrowApyBps: 541 },
  { id: 'maple', name: 'Maple Finance', region: 'global', category: 'credit_pool', envKey: 'MAPLE_BORROW_APY_BPS', defaultBorrowApyBps: 615 },
  { id: 'clearpool', name: 'Clearpool', region: 'global', category: 'credit_pool', envKey: 'CLEARPOOL_BORROW_APY_BPS', defaultBorrowApyBps: 588 },
  { id: 'centrifuge', name: 'Centrifuge', region: 'global', category: 'rwa', envKey: 'CENTRIFUGE_BORROW_APY_BPS', defaultBorrowApyBps: 572 },
  { id: 'goldfinch', name: 'Goldfinch', region: 'global', category: 'rwa', envKey: 'GOLDFINCH_BORROW_APY_BPS', defaultBorrowApyBps: 648 },
  { id: 'truefi', name: 'TrueFi', region: 'global', category: 'credit_pool', envKey: 'TRUEFI_BORROW_APY_BPS', defaultBorrowApyBps: 602 },
  { id: 'ondo', name: 'Ondo Finance', region: 'americas', category: 'institutional', envKey: 'ONDO_BORROW_APY_BPS', defaultBorrowApyBps: 495 },
  { id: 'figure', name: 'Figure Markets', region: 'americas', category: 'rwa', envKey: 'FIGURE_BORROW_APY_BPS', defaultBorrowApyBps: 556 },
  { id: 'liquity', name: 'Liquity v2', region: 'europe', category: 'money_market', envKey: 'LIQUITY_BORROW_APY_BPS', defaultBorrowApyBps: 445 },
  { id: 'venus', name: 'Venus Protocol', region: 'asia_pacific', category: 'money_market', envKey: 'VENUS_BORROW_APY_BPS', defaultBorrowApyBps: 518 },
  { id: 'benqi', name: 'Benqi', region: 'asia_pacific', category: 'money_market', envKey: 'BENQI_BORROW_APY_BPS', defaultBorrowApyBps: 507 },
  { id: 'kamino', name: 'Kamino Finance', region: 'asia_pacific', category: 'money_market', envKey: 'KAMINO_BORROW_APY_BPS', defaultBorrowApyBps: 533 },
  { id: 'justlend', name: 'JustLend (Tron)', region: 'asia_pacific', category: 'money_market', envKey: 'JUSTLEND_BORROW_APY_BPS', defaultBorrowApyBps: 549 },
  { id: 'dydx', name: 'dYdX', region: 'global', category: 'institutional', envKey: 'DYDX_BORROW_APY_BPS', defaultBorrowApyBps: 476 },
  { id: 'frax', name: 'Frax Finance', region: 'global', category: 'money_market', envKey: 'FRAX_BORROW_APY_BPS', defaultBorrowApyBps: 458 },
  { id: 'securitize', name: 'Securitize Credit', region: 'americas', category: 'institutional', envKey: 'SECURITIZE_BORROW_APY_BPS', defaultBorrowApyBps: 525 },
  { id: 'backed', name: 'Backed Finance', region: 'europe', category: 'rwa', envKey: 'BACKED_BORROW_APY_BPS', defaultBorrowApyBps: 564 },
  { id: 'credix', name: 'Credix (LatAm)', region: 'americas', category: 'credit_pool', envKey: 'CREDIX_BORROW_APY_BPS', defaultBorrowApyBps: 635 },
  { id: 'stellar', name: 'Stellar Credit Union', region: 'mea', category: 'institutional', envKey: 'STELLAR_BORROW_APY_BPS', defaultBorrowApyBps: 592 }
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
