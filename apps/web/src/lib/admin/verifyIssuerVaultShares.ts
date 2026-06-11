import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from './assetsService';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { withBaseMainnetRpc } from '../blockchain/baseRpc';

const VAULT_ABI = ['function balanceOf(address account) view returns (uint256)'];
const KYC_ABI = ['function kycApproved(address account) view returns (bool)'];

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return (
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
    );
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
}

async function readIssuerVaultReadinessAtRpc(
  asset: AdminAssetRecord,
  issuerWallet: string,
  rpcUrl: string
): Promise<{ hasShares: boolean; kycApproved: boolean }> {
  const vault = asset.vaultAddress?.trim();
  if (!vault) {
    return { hasShares: false, kycApproved: false };
  }

  const provider = new JsonRpcProvider(rpcUrl);
  try {
    const vaultContract = new Contract(vault, VAULT_ABI, provider);
    const shares = (await vaultContract.balanceOf(issuerWallet)) as bigint;
    let kycApproved = false;

    if (asset.contractAddress) {
      const assetContract = new Contract(asset.contractAddress, KYC_ABI, provider);
      kycApproved = Boolean(await assetContract.kycApproved(issuerWallet));
    }

    return { hasShares: shares > 0n, kycApproved };
  } finally {
    provider.destroy();
  }
}

export async function readIssuerVaultReadiness(
  asset: AdminAssetRecord,
  issuerWallet: string
): Promise<{ hasShares: boolean; kycApproved: boolean }> {
  const chainId = asset.chainId ?? resolveMorphoChainId();

  if (chainId === 8453) {
    try {
      return await withBaseMainnetRpc((rpcUrl) =>
        readIssuerVaultReadinessAtRpc(asset, issuerWallet, rpcUrl)
      );
    } catch {
      return { hasShares: false, kycApproved: false };
    }
  }

  return readIssuerVaultReadinessAtRpc(asset, issuerWallet, resolveRpcUrl(chainId));
}
