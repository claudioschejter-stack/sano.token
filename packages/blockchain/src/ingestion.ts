/** Canonical ownership map for blockchain ingestion (Phase 4). */
export const BLOCKCHAIN_INGESTION_OWNERSHIP = {
  /** Live RPC events → Nest `BlockchainListenerService` (long-running worker). */
  rpcEvents: 'nest-listener',
  /** On-chain writes (deploy, KYC, yield tx) → Next automation jobs. */
  onChainWrites: 'next-automation',
  /** ERC-4626 yield batches + rent payouts → Next yield pipeline. */
  dividendAllocations: 'next-yield-pipeline'
} as const;

export type BlockchainIngestionOwner =
  (typeof BLOCKCHAIN_INGESTION_OWNERSHIP)[keyof typeof BLOCKCHAIN_INGESTION_OWNERSHIP];

/** Nest listener should run when enabled and an RPC URL is configured. */
export function shouldRunNestBlockchainListener(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.BLOCKCHAIN_LISTENER_ENABLED === 'false') {
    return false;
  }
  return Boolean(
    env.BLOCKCHAIN_RPC_URL?.trim() ||
      env.BASE_RPC_URL?.trim() ||
      env.POLYGON_RPC_URL?.trim() ||
      env.NEXT_PUBLIC_RPC_URL?.trim()
  );
}

/** Next automation/on-chain writes (default on). */
export function shouldNextWriteOnChain(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BLOCKCHAIN_WRITES_ENABLED !== 'false';
}

export function resolvePrimaryRpcUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return (
    env.BLOCKCHAIN_RPC_URL?.trim() ||
    env.BASE_RPC_URL?.trim() ||
    env.POLYGON_RPC_URL?.trim() ||
    env.NEXT_PUBLIC_RPC_URL?.trim() ||
    null
  );
}
