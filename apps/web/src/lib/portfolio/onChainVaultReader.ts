import { ethers } from 'ethers';
import { getStablecoinNetwork } from '../payments/stablecoinNetworks';

const ERC4626_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)'
];

export type OnChainVaultPosition = {
  vaultAddress: string;
  chainId: number;
  walletAddress: string;
  shares: string;
  assetsUsd: number;
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

  const polygonNetwork = getStablecoinNetwork('POLYGON');
  if (chainId === polygonNetwork.chainId) {
    return polygonNetwork.rpcUrl;
  }

  return baseNetwork.rpcUrl;
}

function explorerTxBase(chainId: number): string | null {
  if (chainId === 8453) {
    return 'https://basescan.org';
  }
  if (chainId === 84532) {
    return 'https://sepolia.basescan.org';
  }
  if (chainId === 137) {
    return 'https://polygonscan.com';
  }
  return null;
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
  const decimals = input.assetDecimals ?? network.decimals;

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const vault = new ethers.Contract(input.vaultAddress, ERC4626_ABI, provider);
    const shares = (await vault.balanceOf(input.walletAddress)) as bigint;
    const assets =
      shares > 0n ? ((await vault.convertToAssets(shares)) as bigint) : 0n;
    const assetsUsd = Number(ethers.formatUnits(assets, decimals));

    return {
      vaultAddress: ethers.getAddress(input.vaultAddress),
      chainId: input.chainId ?? network.chainId ?? 8453,
      walletAddress: ethers.getAddress(input.walletAddress),
      shares: shares.toString(),
      assetsUsd,
      assetDecimals: decimals,
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
