import { Contract, Interface, JsonRpcProvider, type Signer, isAddress } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { resolveTreasuryOwnerSigner } from './treasuryOwnerSigner';
import { resolveTreasuryAddress } from './treasuryPolicy';
import { execAsOwner } from './safeExec';
import { resolveRwaOperatorSigner } from './rwaOperatorSigner';
import { setInvestorKycAllowlist } from './kycAllowlist';
import {
  deliverSharesViaModule,
  deliveryOperatorModuleAddress,
  moduleCanDeliver
} from './deliveryOperatorModule';

const TOKEN_ABI = [
  'function kycApproved(address) view returns (bool)',
  'function setKyc(address,bool)',
  'function owner() view returns (address)'
];

const VAULT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function owner() view returns (address)'
];

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

async function execAsTreasury(input: {
  treasuryAddress: string;
  signer: Signer;
  target: string;
  data: string;
}): Promise<string> {
  return execAsOwner({
    owner: input.treasuryAddress,
    signer: input.signer,
    target: input.target,
    data: input.data
  });
}

export type MigrateTreasurySharesResult =
  | { ok: true; txHash: string; sharesTransferred: string; recipient: string; treasury: string }
  | { ok: false; code: string; detail?: string };

export async function migrateTreasuryVaultSharesToWallet(input: {
  asset: AdminAssetRecord;
  recipientWallet: string;
  shareAmount?: bigint;
}): Promise<MigrateTreasurySharesResult> {
  const treasury = resolveTreasuryAddress();
  const vault = input.asset.vaultAddress?.trim();
  const token = input.asset.contractAddress?.trim();
  const recipient = input.recipientWallet.trim();

  if (!treasury || !isAddress(treasury)) {
    return { ok: false, code: 'TREASURY_NOT_CONFIGURED' };
  }
  if (!vault || !token) {
    return { ok: false, code: 'VAULT_NOT_DEPLOYED' };
  }
  if (!isAddress(recipient)) {
    return { ok: false, code: 'INVALID_RECIPIENT' };
  }

  const chainId = input.asset.chainId ?? 8453;
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));

  /**
   * Delivery runs through the module whenever it is wired, so a threshold-2
   * Safe does not put a manual signature in the middle of every purchase. The
   * Safe-owner signer is only needed for the fallback path.
   */
  const moduleAddress = deliveryOperatorModuleAddress();
  const operatorSigner = moduleAddress ? await resolveRwaOperatorSigner(provider, chainId).catch(() => null) : null;
  const signer = await resolveTreasuryOwnerSigner(provider, chainId).catch(() => null);

  if (!signer && !operatorSigner) {
    return {
      ok: false,
      code: 'TREASURY_SIGNER_MISSING',
      detail:
        'Configurá PRIVY_SAFE_OWNER_WALLET_ID + TREASURY_OWNER_ADDRESS, o el operador de entrega con DELIVERY_OPERATOR_MODULE_ADDRESS.'
    };
  }

  try {
    const assetContract = new Contract(token, TOKEN_ABI, provider);
    const vaultContract = new Contract(vault, VAULT_ABI, provider);

    const treasuryShares = (await vaultContract.balanceOf(treasury)) as bigint;
    if (treasuryShares <= 0n) {
      return { ok: false, code: 'TREASURY_NO_SHARES', detail: treasury };
    }

    const amount = input.shareAmount ?? treasuryShares;
    if (amount <= 0n || amount > treasuryShares) {
      return {
        ok: false,
        code: 'INVALID_SHARE_AMOUNT',
        detail: `treasury=${treasuryShares.toString()} requested=${amount.toString()}`
      };
    }

    const recipientKyc = await assetContract.kycApproved(recipient);
    if (!recipientKyc) {
      // Prefers the KYC module, so this works with the Safe above threshold 1.
      await setInvestorKycAllowlist({
        tokenAddress: token,
        walletAddress: recipient,
        approved: true
      });
    }

    let txHash: string | null = null;
    if (moduleAddress && operatorSigner) {
      const usable = await moduleCanDeliver({
        moduleAddress,
        vaultAddress: vault,
        investorAddress: recipient,
        amount,
        operatorAddress: await operatorSigner.getAddress(),
        provider
      });
      if (usable) {
        txHash = await deliverSharesViaModule({
          moduleAddress,
          vaultAddress: vault,
          investorAddress: recipient,
          amount,
          signer: operatorSigner
        });
      }
    }

    if (!txHash) {
      if (!signer) {
        return {
          ok: false,
          code: 'DELIVERY_MODULE_UNAVAILABLE',
          detail: `El módulo ${moduleAddress ?? 'no configurado'} no puede entregar este vault y no hay firmante del Safe.`
        };
      }
      const transferData = new Interface(VAULT_ABI).encodeFunctionData('transfer', [
        recipient,
        amount
      ]);
      txHash = await execAsTreasury({
        treasuryAddress: treasury,
        signer,
        target: vault,
        data: transferData
      });
    }

    const recipientShares = (await vaultContract.balanceOf(recipient)) as bigint;
    if (recipientShares < amount) {
      return {
        ok: false,
        code: 'TRANSFER_NOT_VERIFIED',
        detail: `expected>=${amount.toString()} got=${recipientShares.toString()}`
      };
    }

    return {
      ok: true,
      txHash,
      sharesTransferred: amount.toString(),
      recipient,
      treasury
    };
  } catch (error) {
    return {
      ok: false,
      code: 'TRANSFER_FAILED',
      detail: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    provider.destroy();
  }
}
