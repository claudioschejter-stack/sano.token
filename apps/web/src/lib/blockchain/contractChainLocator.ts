import { JsonRpcProvider } from 'ethers';

export type CandidateChain = {
  chainId: number;
  name: string;
  rpcUrl: string;
};

/**
 * Chains an address could plausibly live on. Used only for diagnostics: when a
 * contract read fails, "no responde" is indistinguishable from "estás mirando
 * la red equivocada", and that ambiguity has cost us real debugging time.
 */
export function candidateChains(): CandidateChain[] {
  const configured: CandidateChain[] = [];
  const rpc = process.env.BASE_RPC_URL?.trim();
  if (rpc) {
    configured.push({ chainId: 0, name: 'BASE_RPC_URL (configurado)', rpcUrl: rpc });
  }
  const lendingRpc = process.env.LENDING_BASE_RPC_URL?.trim();
  if (lendingRpc && lendingRpc !== rpc) {
    configured.push({
      chainId: 0,
      name: 'LENDING_BASE_RPC_URL (configurado)',
      rpcUrl: lendingRpc
    });
  }

  return [
    ...configured,
    { chainId: 8453, name: 'Base', rpcUrl: 'https://mainnet.base.org' },
    { chainId: 84532, name: 'Base Sepolia', rpcUrl: 'https://sepolia.base.org' },
    { chainId: 98866, name: 'Plume', rpcUrl: 'https://rpc.plume.org' },
    { chainId: 98867, name: 'Plume Testnet', rpcUrl: 'https://testnet-rpc.plume.org' },
    { chainId: 1, name: 'Ethereum', rpcUrl: 'https://eth.llamarpc.com' },
    { chainId: 42161, name: 'Arbitrum', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
    { chainId: 137, name: 'Polygon', rpcUrl: 'https://polygon-rpc.com' },
    { chainId: 10, name: 'Optimism', rpcUrl: 'https://mainnet.optimism.io' }
  ];
}

export type ContractLocation = {
  address: string;
  label: string;
  /** Chains where this address has contract code. */
  foundOn: Array<{ chainId: number; name: string; rpcUrl: string }>;
  checkedChains: number;
};

async function chainHasCode(
  chain: CandidateChain,
  addresses: string[]
): Promise<{ chainId: number; name: string; rpcUrl: string; withCode: string[] } | null> {
  const provider = new JsonRpcProvider(chain.rpcUrl);
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const withCode: string[] = [];
    for (const address of addresses) {
      try {
        const code = await provider.getCode(address);
        if (code && code !== '0x') {
          withCode.push(address.toLowerCase());
        }
      } catch {
        // A single unreachable read must not discard the whole chain.
      }
    }
    return { chainId, name: chain.name, rpcUrl: chain.rpcUrl, withCode };
  } catch {
    return null;
  } finally {
    provider.destroy();
  }
}

/**
 * Find which chains actually host the given contracts.
 *
 * Answers the question that every "owner is unknown" hides: are the contracts
 * broken, or is the RPC pointing somewhere else entirely?
 */
export async function locateContracts(
  entries: Array<{ address: string; label: string }>
): Promise<ContractLocation[]> {
  const unique = new Map<string, string>();
  for (const entry of entries) {
    const key = entry.address.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, entry.label);
    }
  }
  const addresses = [...unique.keys()];
  if (!addresses.length) {
    return [];
  }

  const chains = candidateChains();
  const results = await Promise.all(chains.map((chain) => chainHasCode(chain, addresses)));
  const reachable = results.filter((row): row is NonNullable<typeof row> => row !== null);

  // Two entries can resolve to the same live chain (a configured RPC and its
  // public twin); keep the first so the report does not read as duplicated.
  const seenChainIds = new Set<number>();
  const deduped = reachable.filter((row) => {
    if (seenChainIds.has(row.chainId)) return false;
    seenChainIds.add(row.chainId);
    return true;
  });

  return addresses.map((address) => ({
    address,
    label: unique.get(address) ?? address,
    foundOn: deduped
      .filter((row) => row.withCode.includes(address))
      .map((row) => ({ chainId: row.chainId, name: row.name, rpcUrl: row.rpcUrl })),
    checkedChains: deduped.length
  }));
}
