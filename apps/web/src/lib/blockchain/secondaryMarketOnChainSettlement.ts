import { Contract, Interface, JsonRpcProvider, type Signer, isAddress } from 'ethers';
import { getAdminAsset } from '../admin/assetsService';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { readVaultShareDecimals, vaultSharesForTokens } from './vaultShareUnits';
import { ensureSellerVaultAllowance } from '../secondaryMarket/ensureSellerVaultAllowance';
import { usdcDecimals, usdcTokenAddress } from '../payments/paymentConfig';
import { waitForAutomationTx } from './automationTx';
import { resolveTreasuryAddress } from './treasuryPolicy';
import { resolveTreasuryOwnerSigner } from './treasuryOwnerSigner';
import { execAsOwner } from './safeExec';

const TOKEN_ABI = [
  'function kycApproved(address) view returns (bool)',
  'function setKyc(address,bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)'
];

const VAULT_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)'
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

async function ensureRecipientKyc(
  assetToken: Contract,
  treasuryAddress: string,
  signer: Signer,
  recipient: string
): Promise<void> {
  const approved = (await assetToken.kycApproved(recipient)) as boolean;
  if (approved) {
    return;
  }

  const setKycData = new Interface(TOKEN_ABI).encodeFunctionData('setKyc', [recipient, true]);
  await execAsOwner({
    owner: treasuryAddress,
    signer,
    target: String(assetToken.target),
    data: setKycData
  });
}

export type SecondaryP2pSettlementInput = {
  buyerUserId: string;
  sellerUserId: string;
  projectId: string;
  tokenCount: number;
  totalUsd: number;
};

export type SecondaryP2pSettlementResult = {
  usdcTxHash: string;
  vaultTxHash: string;
  buyerWallet: string;
  sellerWallet: string;
};

/**
 * Settle secondary P2P trade on-chain: USDC from buyer to seller and vault shares seller to buyer.
 * Requires both parties to have approved the treasury operator for USDC and vault shares.
 */
export async function settleSecondaryP2pOnChain(
  input: SecondaryP2pSettlementInput
): Promise<SecondaryP2pSettlementResult> {
  const buyerWallet = await getLinkedWalletForUser(input.buyerUserId);
  const sellerWallet = await getLinkedWalletForUser(input.sellerUserId);

  if (!buyerWallet || !isAddress(buyerWallet)) {
    throw new Error('INVESTOR_WALLET_REQUIRED');
  }
  if (!sellerWallet || !isAddress(sellerWallet)) {
    throw new Error('SELLER_WALLET_REQUIRED');
  }

  const asset = await getAdminAsset(input.projectId);
  const vault = asset?.vaultAddress?.trim();
  const token = asset?.contractAddress?.trim();
  const usdc = usdcTokenAddress();

  if (!vault || !token || !usdc) {
    throw new Error('ON_CHAIN_SETTLEMENT_UNAVAILABLE');
  }

  const treasury = resolveTreasuryAddress();
  const chainId = asset.chainId ?? 8453;
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const operator = await resolveTreasuryOwnerSigner(provider, chainId);

  if (!treasury || !isAddress(treasury) || !operator) {
    throw new Error('ON_CHAIN_SETTLEMENT_OPERATOR_MISSING');
  }

  const operatorAddress = await operator.getAddress();

  const shareDecimals = await readVaultShareDecimals({ provider, vaultAddress: vault });
  if (shareDecimals === null) {
    throw new Error('VAULT_DECIMALS_UNREADABLE');
  }
  const shareAmount = vaultSharesForTokens(input.tokenCount, shareDecimals);
  if (shareAmount <= 0n) {
    throw new Error('INVALID_TOKEN_COUNT');
  }

  const usdcAmount = BigInt(Math.round(input.totalUsd * 10 ** usdcDecimals()));
  if (usdcAmount <= 0n) {
    throw new Error('INVALID_SETTLEMENT_AMOUNT');
  }

  try {
    const usdcContract = new Contract(usdc, TOKEN_ABI, operator);
    const vaultContract = new Contract(vault, VAULT_ABI, provider);
    const assetContract = new Contract(token, TOKEN_ABI, operator);

    const buyerUsdcAllowance = (await usdcContract.allowance(buyerWallet, operatorAddress)) as bigint;
    if (buyerUsdcAllowance < usdcAmount) {
      throw new Error('BUYER_USDC_ALLOWANCE_REQUIRED');
    }

    const sellerShareBalance = (await vaultContract.balanceOf(sellerWallet)) as bigint;
    if (sellerShareBalance < shareAmount) {
      throw new Error('INSUFFICIENT_SELLER_ON_CHAIN_SHARES');
    }

    // Same as the buyback: the seller's allowance is granted here, not demanded.
    const sellerAllowance = await ensureSellerVaultAllowance({
      userId: input.sellerUserId,
      vaultAddress: vault,
      operatorAddress,
      shareAmount,
      chainId,
      provider
    });
    if (sellerAllowance.ok === false) {
      throw new Error(
        sellerAllowance.detail
          ? `${sellerAllowance.code}:${sellerAllowance.detail}`
          : sellerAllowance.code
      );
    }

    const buyerUsdcBalance = (await new Contract(usdc, ['function balanceOf(address) view returns (uint256)'], provider).balanceOf(
      buyerWallet
    )) as bigint;
    if (buyerUsdcBalance < usdcAmount) {
      throw new Error('INSUFFICIENT_BUYER_USDC');
    }

    await ensureRecipientKyc(assetContract, treasury, operator, buyerWallet);

    const usdcTx = await usdcContract.transferFrom(buyerWallet, sellerWallet, usdcAmount);
    const usdcReceipt = await waitForAutomationTx(usdcTx);
    const usdcTxHash = usdcReceipt?.hash ?? usdcTx.hash;

    const vaultContractWithSigner = new Contract(vault, VAULT_ABI, operator);
    const vaultTx = await vaultContractWithSigner.transferFrom(sellerWallet, buyerWallet, shareAmount);
    const vaultReceipt = await waitForAutomationTx(vaultTx);
    const vaultTxHash = vaultReceipt?.hash ?? vaultTx.hash;

    const buyerShares = (await vaultContract.balanceOf(buyerWallet)) as bigint;
    if (buyerShares < shareAmount) {
      throw new Error('ON_CHAIN_SETTLEMENT_VERIFY_FAILED');
    }

    return {
      usdcTxHash,
      vaultTxHash,
      buyerWallet,
      sellerWallet
    };
  } finally {
    provider.destroy();
  }
}

export type PlatformBuybackSettlementResult = {
  vaultTxHash: string;
  sellerWallet: string;
  treasuryAddress: string;
};

/**
 * Platform buyback: move vault shares from seller to treasury on-chain (Sanova-only exit).
 * USDC payment is credited to the seller's platform wallet after shares are transferred.
 */
export async function settlePlatformBuybackOnChain(input: {
  sellerUserId: string;
  projectId: string;
  tokenCount: number;
}): Promise<PlatformBuybackSettlementResult> {
  const sellerWallet = await getLinkedWalletForUser(input.sellerUserId);

  if (!sellerWallet || !isAddress(sellerWallet)) {
    throw new Error('INVESTOR_WALLET_REQUIRED');
  }

  const asset = await getAdminAsset(input.projectId);
  const vault = asset?.vaultAddress?.trim();
  const token = asset?.contractAddress?.trim();

  if (!vault || !token) {
    throw new Error('ON_CHAIN_SETTLEMENT_UNAVAILABLE');
  }

  const treasury = resolveTreasuryAddress();
  const chainId = asset.chainId ?? 8453;
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const operator = await resolveTreasuryOwnerSigner(provider, chainId);

  if (!treasury || !isAddress(treasury) || !operator) {
    throw new Error('ON_CHAIN_SETTLEMENT_OPERATOR_MISSING');
  }

  const shareDecimals = await readVaultShareDecimals({ provider, vaultAddress: vault });
  if (shareDecimals === null) {
    throw new Error('VAULT_DECIMALS_UNREADABLE');
  }
  const shareAmount = vaultSharesForTokens(input.tokenCount, shareDecimals);
  if (shareAmount <= 0n) {
    throw new Error('INVALID_TOKEN_COUNT');
  }

  const operatorAddress = await operator.getAddress();

  try {
    const vaultContract = new Contract(vault, VAULT_ABI, provider);
    const assetContract = new Contract(token, TOKEN_ABI, operator);

    const sellerShareBalance = (await vaultContract.balanceOf(sellerWallet)) as bigint;
    if (sellerShareBalance < shareAmount) {
      throw new Error('INSUFFICIENT_SELLER_ON_CHAIN_SHARES');
    }

    /**
     * Grant the allowance as part of the sale instead of demanding it first.
     * There was no screen or endpoint to give it, so this check turned "Vender"
     * into a button that always failed.
     */
    const allowance = await ensureSellerVaultAllowance({
      userId: input.sellerUserId,
      vaultAddress: vault,
      operatorAddress,
      shareAmount,
      chainId,
      provider
    });
    if (allowance.ok === false) {
      throw new Error(allowance.detail ? `${allowance.code}:${allowance.detail}` : allowance.code);
    }

    await ensureRecipientKyc(assetContract, treasury, operator, treasury);

    const vaultContractWithSigner = new Contract(vault, VAULT_ABI, operator);
    const vaultTx = await vaultContractWithSigner.transferFrom(sellerWallet, treasury, shareAmount);
    const vaultReceipt = await waitForAutomationTx(vaultTx);
    const vaultTxHash = vaultReceipt?.hash ?? vaultTx.hash;

    const treasuryShares = (await vaultContract.balanceOf(treasury)) as bigint;
    if (treasuryShares < shareAmount) {
      throw new Error('ON_CHAIN_SETTLEMENT_VERIFY_FAILED');
    }

    return { vaultTxHash, sellerWallet, treasuryAddress: treasury };
  } finally {
    provider.destroy();
  }
}
