import { prisma } from '@sanova/database';
import { ethers } from 'ethers';
import { baseRpcUrls, getStablecoinNetwork } from '../payments/stablecoinNetworks';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import { recordTokenMovement } from './tokenMovementLedger';
import { platformAddressRegistry, type PlatformAddress } from './platformAddressRegistry';
import { resolveLedgerStartBlock } from './ledgerWatermark';
import { attributeMovement, classifyMovement, classifyShareMovement } from './classifyMovement';
import { readVaultShareDecimals } from '../blockchain/vaultShareUnits';

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const RPC_CHUNK = 9_500;
const DEFAULT_LOOKBACK = 40_000;
/** Ceiling on one run, so a long outage cannot produce an unbounded scan. */
const MAX_SPAN_BLOCKS = 400_000;

type OwnerLookup = {
  registry: Map<string, PlatformAddress>;
};

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
    // Resume where the ledger left off, so a skipped run leaves no hole.
    const startBlock = await resolveLedgerStartBlock({
      contractAddress: contract,
      latestBlock: latest,
      fallbackLookback: input.lookbackBlocks,
      maxSpan: MAX_SPAN_BLOCKS
    });
    let indexed = 0;

    for (let start = startBlock; start <= latest; start += RPC_CHUNK) {
      const end = Math.min(start + RPC_CHUNK - 1, latest);
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

        const fromEntry = input.owners.registry.get(fromKey);
        const toEntry = input.owners.registry.get(toKey);

        const kind =
          input.asset === 'USDC'
            ? classifyMovement({
                asset: 'USDC',
                fromRole: fromEntry?.role ?? null,
                toRole: toEntry?.role ?? null
              })
            : classifyShareMovement({
                fromAddress: from,
                toAddress: to,
                fromRole: fromEntry?.role ?? null,
                toRole: toEntry?.role ?? null
              });

        const attribution = attributeMovement(fromEntry, toEntry);

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
          userId: attribution.userId,
          investorId: attribution.investorId,
          metadata: {
            source: 'vault-indexer',
            fromRole: fromEntry?.role ?? null,
            toRole: toEntry?.role ?? null,
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
  const registry = await platformAddressRegistry();
  const owners: OwnerLookup = { registry };
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
    /**
     * Asked of the vault, because the ledger keeps these rows forever: writing a
     * guessed unit into history is how a report ends up a thousand times off
     * with no way to tell after the fact.
     */
    const shareDecimals = await withProvider((provider) =>
      readVaultShareDecimals({ provider, vaultAddress: project.vaultAddress! })
    ).catch(() => null);
    if (shareDecimals === null) {
      console.error('[indexTokenMovements] vault decimals unreadable, skipping', project.id);
      continue;
    }
    shareIndexed += await indexTransfers({
      contractAddress: project.vaultAddress,
      decimals: shareDecimals,
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
  if (network.tokenAddress) {
    /**
     * USDC is far too busy to index wholesale, so it is filtered by address —
     * and that filter is the registry. Previously it held only the token
     * treasury and wallets saved on `User`, so rent from the stablecoin
     * treasury, liquidity going to Morpho and gas moved between operators all
     * fell outside it and left no trace.
     */
    const relevant = new Set<string>(registry.keys());
    if (treasuryAddress) relevant.add(treasuryAddress.toLowerCase());

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
