import { ethers } from 'ethers';
import { baseRpcUrls } from '../payments/stablecoinNetworks';
import { sharesToTokens } from './tokenReconciliationMath';

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ERC20_TOTAL_SUPPLY_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];
const RPC_CHUNK = 9_500;
const DEFAULT_LOOKBACK_BLOCKS = 200_000;

export type VaultShareMovement = {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  shares: string;
  tokens: number | null;
  /** Mint (from zero address) / burn (to zero address) / transfer. */
  kind: 'MINT' | 'BURN' | 'TRANSFER';
  fromLabel: string;
  toLabel: string;
};

export type WalletLabels = Record<string, string>;

function labelFor(address: string, labels: WalletLabels): string {
  const key = address.toLowerCase();
  if (key === ethers.ZeroAddress.toLowerCase()) return 'mint/burn';
  return labels[key] ?? address;
}

/**
 * On-chain movement log (bitácora) for a project's ERC-4626 vault shares.
 * The asset-token indexer never watched the vault, so treasury → investor
 * deliveries had no queryable history.
 */
export async function readVaultShareMovements(input: {
  vaultAddress: string;
  lookbackBlocks?: number;
  labels?: WalletLabels;
  /** Only movements touching these addresses (lowercase compared). */
  filterAddresses?: string[];
}): Promise<VaultShareMovement[]> {
  const vault = ethers.getAddress(input.vaultAddress);
  const lookback = input.lookbackBlocks ?? DEFAULT_LOOKBACK_BLOCKS;
  const labels = input.labels ?? {};
  const filter = new Set((input.filterAddresses ?? []).map((row) => row.trim().toLowerCase()));

  let lastError: unknown = null;
  for (const url of baseRpcUrls()) {
    const provider = new ethers.JsonRpcProvider(url, 8453, { staticNetwork: true });
    try {
      const latest = await provider.getBlockNumber();
      const movements: VaultShareMovement[] = [];
      // The vault's own share unit: reading it once beats assuming it per log.
      const shareDecimals = Number(
        (await new ethers.Contract(vault, ERC20_TOTAL_SUPPLY_ABI, provider).decimals()) as bigint
      );

      for (let end = latest; end > latest - lookback; end -= RPC_CHUNK) {
        const start = Math.max(0, end - RPC_CHUNK + 1);
        const logs = await provider.getLogs({
          address: vault,
          topics: [TRANSFER_TOPIC],
          fromBlock: start,
          toBlock: end
        });

        for (const log of logs) {
          const from = ethers.getAddress(`0x${log.topics[1].slice(26)}`);
          const to = ethers.getAddress(`0x${log.topics[2].slice(26)}`);
          if (
            filter.size > 0 &&
            !filter.has(from.toLowerCase()) &&
            !filter.has(to.toLowerCase())
          ) {
            continue;
          }

          const shares = BigInt(log.data);
          movements.push({
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            from,
            to,
            shares: shares.toString(),
            tokens: sharesToTokens(shares, shareDecimals),
            kind:
              from === ethers.ZeroAddress
                ? 'MINT'
                : to === ethers.ZeroAddress
                  ? 'BURN'
                  : 'TRANSFER',
            fromLabel: labelFor(from, labels),
            toLabel: labelFor(to, labels)
          });
        }
      }

      provider.destroy();
      return movements.sort((a, b) => b.blockNumber - a.blockNumber);
    } catch (error) {
      provider.destroy();
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('BASE_RPC_UNAVAILABLE');
}

/** Vault share totals needed to reconcile a project's supply. */
export async function readVaultSupplyAndBalance(input: {
  vaultAddress: string;
  holderAddress?: string | null;
}): Promise<{
  totalSupplyShares: string | null;
  holderShares: string | null;
  /** Carried alongside the raw amounts: they mean nothing without it. */
  shareDecimals: number | null;
}> {
  const vault = ethers.getAddress(input.vaultAddress);

  for (const url of baseRpcUrls()) {
    const provider = new ethers.JsonRpcProvider(url, 8453, { staticNetwork: true });
    try {
      const contract = new ethers.Contract(vault, ERC20_TOTAL_SUPPLY_ABI, provider);
      const totalSupply = (await contract.totalSupply()) as bigint;
      const shareDecimals = Number((await contract.decimals()) as bigint);
      let holderShares: bigint | null = null;
      if (input.holderAddress?.trim()) {
        holderShares = (await contract.balanceOf(
          ethers.getAddress(input.holderAddress)
        )) as bigint;
      }
      provider.destroy();
      return {
        totalSupplyShares: totalSupply.toString(),
        holderShares: holderShares === null ? null : holderShares.toString(),
        shareDecimals
      };
    } catch {
      provider.destroy();
    }
  }

  return { totalSupplyShares: null, holderShares: null, shareDecimals: null };
}
