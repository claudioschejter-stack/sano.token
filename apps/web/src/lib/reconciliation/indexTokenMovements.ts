import { prisma } from '@sanova/database';
import { ethers } from 'ethers';
import { baseRpcUrls, getStablecoinNetwork } from '../payments/stablecoinNetworks';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import { recordTokenMovement } from './tokenMovementLedger';

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const RPC_CHUNK = 9_500;
const DEFAULT_LOOKBACK = 40_000;

type OwnerLookup = {
  userIdByAddress: Map<string, { userId: string; investorId: string | null }>;
};

async function loadOwners(): Promise<OwnerLookup> {
  const users = await prisma.user.findMany({
    where: { walletAddress: { not: null } },
    select: { id: true, walletAddress: true, investorId: true }
  });

  const userIdByAddress = new Map<string, { userId: string; investorId: string | null }>();
  for (const user of users) {
    if (!user.walletAddress) continue;
    userIdByAddress.set(user.walletAddress.trim().toLowerCase(), {
      userId: user.id,
      investorId: user.investorId
    });
  }
  return { userIdByAddress };
}

async function withProvider<T>(run: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (const url of baseRpcUrls()) {
    const provider = new ethers.JsonRpcProvider(url, 8453, { staticNetwork: true });
    try {
      const result = await run(provider);
      provider.destroy();
      return result;
    } catch (error) {
      provider.destroy();
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('BASE_RPC_UNAVAILABLE');
}

async function indexTransfers(input: {
  contractAddress: string;
  decimals: number;
  asset: 'USDC' | 'RWA_SHARE';
  projectId?: string | null;
  lookbackBlocks: number;
  owners: OwnerLookup;
  treasuryAddress: string | null;
  /** Only persist movements touching one of these (lowercase). */
  relevantAddresses?: Set<string> | null;
}): Promise<number> {
  const contract = ethers.getAddress(input.contractAddress);

  return withProvider(async (provider) => {
    const latest = await provider.getBlockNumber();
    let indexed = 0;

    for (let end = latest; end > latest - input.lookbackBlocks; end -= RPC_CHUNK) {
      const start = Math.max(0, end - RPC_CHUNK + 1);
      const logs = await provider.getLogs({
        address: contract,
        topics: [TRANSFER_TOPIC],
        fromBlock: start,
        toBlock: end
      });

      for (const log of logs) {
        const from = `0x${log.topics[1].slice(26)}`;
        const to = `0x${log.topics[2].slice(26)}`;
        const fromKey = from.toLowerCase();
        const toKey = to.toLowerCase();

        if (
          input.relevantAddresses &&
          !input.relevantAddresses.has(fromKey) &&
          !input.relevantAddresses.has(toKey)
        ) {
          continue;
        }

        const owner = input.owners.userIdByAddress.get(toKey) ?? input.owners.userIdByAddress.get(fromKey);
        const isMint = fromKey === ethers.ZeroAddress.toLowerCase();
        const isBurn = toKey === ethers.ZeroAddress.toLowerCase();

        const kind =
          input.asset === 'USDC'
            ? 'USDC_PAYMENT'
            : isMint
              ? 'RWA_SHARE_MINT'
              : isBurn
                ? 'RWA_SHARE_BURN'
                : 'RWA_SHARE_TRANSFER';

        await recordTokenMovement({
          kind,
          asset: input.asset,
          contractAddress: contract,
          fromAddress: from,
          toAddress: to,
          amountRaw: BigInt(log.data).toString(),
          decimals: input.decimals,
          txHash: log.transactionHash,
          logIndex: log.index,
          blockNumber: log.blockNumber,
          projectId: input.projectId ?? null,
          userId: owner?.userId ?? null,
          investorId: owner?.investorId ?? null,
          metadata: {
            source: 'vault-indexer',
            treasury: input.treasuryAddress?.toLowerCase() ?? null
          }
        });
        indexed += 1;
      }
    }

    return indexed;
  });
}

export type IndexTokenMovementsResult = {
  usdcIndexed: number;
  shareIndexed: number;
  vaults: number;
};

/**
 * Persist the on-chain bitácora: RWA vault share transfers for every project and
 * treasury-bound USDC payments. Vault `Transfer` events were previously invisible
 * because only the underlying asset token was indexed.
 */
export async function indexTokenMovements(input?: {
  lookbackBlocks?: number;
  projectId?: string | null;
}): Promise<IndexTokenMovementsResult> {
  const lookbackBlocks = input?.lookbackBlocks ?? DEFAULT_LOOKBACK;
  const owners = await loadOwners();
  const network = getStablecoinNetwork('BASE');
  const treasuryAddress =
    resolveTreasuryAddress(network.treasuryAddress) ?? network.treasuryAddress ?? null;

  const projects = await prisma.project.findMany({
    where: {
      vaultAddress: { not: null },
      ...(input?.projectId ? { id: input.projectId } : {})
    },
    select: { id: true, vaultAddress: true }
  });

  let shareIndexed = 0;
  for (const project of projects) {
    if (!project.vaultAddress) continue;
    shareIndexed += await indexTransfers({
      contractAddress: project.vaultAddress,
      decimals: 18,
      asset: 'RWA_SHARE',
      projectId: project.id,
      lookbackBlocks,
      owners,
      treasuryAddress
    }).catch((error) => {
      console.error('[indexTokenMovements] vault failed', project.id, error);
      return 0;
    });
  }

  let usdcIndexed = 0;
  if (network.tokenAddress && treasuryAddress) {
    // USDC has huge volume: only movements touching treasury or investor wallets.
    const relevant = new Set<string>([treasuryAddress.toLowerCase()]);
    for (const key of owners.userIdByAddress.keys()) relevant.add(key);

    usdcIndexed = await indexTransfers({
      contractAddress: network.tokenAddress,
      decimals: network.decimals ?? 6,
      asset: 'USDC',
      lookbackBlocks,
      owners,
      treasuryAddress,
      relevantAddresses: relevant
    }).catch((error) => {
      console.error('[indexTokenMovements] usdc failed', error);
      return 0;
    });
  }

  return { usdcIndexed, shareIndexed, vaults: projects.length };
}
