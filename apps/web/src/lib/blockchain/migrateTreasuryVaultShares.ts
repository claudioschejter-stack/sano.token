import { Contract, Interface, JsonRpcProvider, type Signer, isAddress } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { resolveTreasuryOwnerSigner } from './treasuryOwnerSigner';
import { resolveTreasuryAddress } from './treasuryPolicy';
import { waitForAutomationTx } from './automationTx';

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

const SAFE_ABI = [
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) payable returns (bool success)',
  'function getThreshold() view returns (uint256)',
  'function getOwners() view returns (address[])'
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
  const signerAddress = await input.signer.getAddress();
  const code = await input.signer.provider!.getCode(input.treasuryAddress);
  const isSafe = code !== '0x';

  if (!isSafe) {
    if (signerAddress.toLowerCase() !== input.treasuryAddress.toLowerCase()) {
      throw new Error(
        'EOA treasury: el firmante treasury debe coincidir con TOKEN_TREASURY_ADDRESS.'
      );
    }
    const tx = await input.signer.sendTransaction({ to: input.target, data: input.data });
    const receipt = await waitForAutomationTx(tx);
    return receipt?.hash ?? tx.hash;
  }

  const safe = new Contract(input.treasuryAddress, SAFE_ABI, input.signer);
  const owners: string[] = await safe.getOwners();
  const signerIsOwner = owners.some(
    (owner) => owner.toLowerCase() === signerAddress.toLowerCase()
  );

  if (!signerIsOwner) {
    throw new Error(
      `La wallet firmante ${signerAddress} no es owner del Safe treasury ${input.treasuryAddress}.`
    );
  }

  const tx = await safe.execTransaction(
    input.target,
    0,
    input.data,
    0,
    0,
    0,
    0,
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000',
    '0x'
  );
  const receipt = await waitForAutomationTx(tx);
  return receipt?.hash ?? tx.hash;
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
  const signer = await resolveTreasuryOwnerSigner(provider, chainId);
  if (!signer) {
    return {
      ok: false,
      code: 'TREASURY_SIGNER_MISSING',
      detail:
        'Configurá PRIVY_SAFE_OWNER_WALLET_ID + TREASURY_OWNER_ADDRESS o TREASURY_OWNER_PRIVATE_KEY.'
    };
  }

  try {
    const assetContract = new Contract(token, TOKEN_ABI, signer);
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
      const setKycData = new Interface(TOKEN_ABI).encodeFunctionData('setKyc', [recipient, true]);
      await execAsTreasury({
        treasuryAddress: treasury,
        signer,
        target: token,
        data: setKycData
      });
    }

    const transferData = new Interface(VAULT_ABI).encodeFunctionData('transfer', [recipient, amount]);
    const txHash = await execAsTreasury({
      treasuryAddress: treasury,
      signer,
      target: vault,
      data: transferData
    });

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
