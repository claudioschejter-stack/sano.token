import { ethers } from 'ethers';
import { getStablecoinNetwork } from '../payments/stablecoinNetworks';

const ERC4626_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function asset() view returns (address)'
];
const ERC20_DECIMALS_ABI = ['function decimals() view returns (uint8)'];

export type OnChainVaultPosition = {
  vaultAddress: string;
  chainId: number;
  walletAddress: string;
  shares: string;
  /**
   * Underlying asset tokens the shares are worth, scaled by the asset's own
   * decimals. Not a USD amount: the price per token lives in the project, so
   * only the caller can turn this into money. It used to be called `assetsUsd`
   * and formatted with USDC's 6 decimals against an 18-decimal asset, which
   * would have shown the first investor to actually receive a share a portfolio
   * a trillion times too large, with a verified check beside it.
   */
  assetTokens: number;
  /** The vault's share decimals, which the offset makes vault-specific. */
  shareDecimals: number;
  assetDecimals: number;
  verified: boolean;
};

export type OnChainPositionEnrichment = OnChainVaultPosition & {
  explorerUrl: string | null;
};

function resolveRpcUrl(chainId?: number | null): string | null {
  const baseNetwork = getStablecoinNetwork('BASE');
  if (!chainId || chainId === baseNetwork.chainId) {
    return baseNetwork.rpcUrl;
  }

  return baseNetwork.rpcUrl;
}

function explorerTxBase(chainId: number): string | null {
  if (chainId === 8453) {
    return 'https://basescan.org';
  }
  return 'https://basescan.org';
}

export function buildVaultExplorerUrl(chainId: number, vaultAddress: string): string | null {
  const base = explorerTxBase(chainId);
  return base ? `${base}/address/${vaultAddress}` : null;
}

export function buildTxExplorerUrl(chainId: number, txHash: string): string | null {
  const base = explorerTxBase(chainId);
  return base ? `${base}/tx/${txHash}` : null;
}

export async function readVaultPosition(input: {
  walletAddress: string;
  vaultAddress: string;
  chainId?: number | null;
  assetDecimals?: number;
}): Promise<OnChainVaultPosition | null> {
  const rpcUrl = resolveRpcUrl(input.chainId);
  if (!rpcUrl || !input.vaultAddress?.trim() || !input.walletAddress?.trim()) {
    return null;
  }

  const network = getStablecoinNetwork('BASE');

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const vault = new ethers.Contract(input.vaultAddress, ERC4626_ABI, provider);
    const shares = (await vault.balanceOf(input.walletAddress)) as bigint;
    const shareDecimals = Number((await vault.decimals()) as bigint);

    // The underlying's decimals, asked of the underlying.
    let assetDecimals = input.assetDecimals ?? null;
    if (assetDecimals === null) {
      const assetAddress = (await vault.asset()) as string;
      assetDecimals = Number(
        (await new ethers.Contract(assetAddress, ERC20_DECIMALS_ABI, provider).decimals()) as bigint
      );
    }

    const assets = shares > 0n ? ((await vault.convertToAssets(shares)) as bigint) : 0n;
    const assetTokens = Number(ethers.formatUnits(assets, assetDecimals));

    return {
      vaultAddress: ethers.getAddress(input.vaultAddress),
      chainId: input.chainId ?? network.chainId ?? 8453,
      walletAddress: ethers.getAddress(input.walletAddress),
      shares: shares.toString(),
      assetTokens,
      shareDecimals,
      assetDecimals,
      verified: true
    };
  } catch (error) {
    console.error('[readVaultPosition]', input.vaultAddress, error);
    return null;
  }
}

export async function readVaultPositionsForProjects(input: {
  walletAddress: string;
  projects: Array<{ projectId: string; vaultAddress: string | null; chainId: number | null }>;
}): Promise<Map<string, OnChainPositionEnrichment>> {
  const map = new Map<string, OnChainPositionEnrichment>();

  await Promise.all(
    input.projects
      .filter((project) => Boolean(project.vaultAddress))
      .map(async (project) => {
        const position = await readVaultPosition({
          walletAddress: input.walletAddress,
          vaultAddress: project.vaultAddress!,
          chainId: project.chainId
        });

        if (!position) {
          return;
        }

        map.set(project.projectId, {
          ...position,
          explorerUrl: buildVaultExplorerUrl(position.chainId, position.vaultAddress)
        });
      })
  );

  return map;
}
