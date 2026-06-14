import { Contract, Interface, JsonRpcProvider, Wallet, isAddress } from 'ethers';
import { getAdminAsset } from '../admin/assetsService';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { vaultSharesForTokenCount } from './investorVaultShareDelivery';
import { usdcDecimals, usdcTokenAddress } from '../payments/paymentConfig';
import { waitForAutomationTx } from './automationTx';
import { resolveTreasuryAddress } from './treasuryPolicy';

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

function resolveOperatorSignerKey(): string | null {
  return (
    process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
    process.env.TOKEN_TREASURY_SIGNER_PRIVATE_KEY?.trim() ||
    null
  );
}

async function ensureRecipientKyc(
  assetToken: Contract,
  treasuryAddress: string,
  signer: Wallet,
  recipient: string
): Promise<void> {
  const approved = (await assetToken.kycApproved(recipient)) as boolean;
  if (approved) {
    return;
  }

  const setKycData = new Interface(TOKEN_ABI).encodeFunctionData('setKyc', [recipient, true]);
  const treasuryCode = await signer.provider!.getCode(treasuryAddress);
  if (treasuryCode === '0x') {
    if (signer.address.toLowerCase() !== treasuryAddress.toLowerCase()) {
      throw new Error('ON_CHAIN_SETTLEMENT_KYC_FAILED');
    }
    const tx = await signer.sendTransaction({ to: assetToken.target, data: setKycData });
    await waitForAutomationTx(tx);
    return;
  }

  const SAFE_ABI = [
    'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) payable returns (bool success)'
  ];
  const safe = new Contract(treasuryAddress, SAFE_ABI, signer);
  const tx = await safe.execTransaction(
    assetToken.target,
    0,
    setKycData,
    0,
    0,
    0,
    0,
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000',
    '0x'
  );
  await waitForAutomationTx(tx);
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
  const operatorKey = resolveOperatorSignerKey();

  if (!treasury || !isAddress(treasury) || !operatorKey) {
    throw new Error('ON_CHAIN_SETTLEMENT_OPERATOR_MISSING');
  }

  const shareAmount = vaultSharesForTokenCount(input.tokenCount);
  if (shareAmount <= 0n) {
    throw new Error('INVALID_TOKEN_COUNT');
  }

  const usdcAmount = BigInt(Math.round(input.totalUsd * 10 ** usdcDecimals()));
  if (usdcAmount <= 0n) {
    throw new Error('INVALID_SETTLEMENT_AMOUNT');
  }

  const chainId = asset.chainId ?? 8453;
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const operator = new Wallet(operatorKey, provider);
  const operatorAddress = operator.address;

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

    const sellerVaultAllowance = (await vaultContract.allowance(sellerWallet, operatorAddress)) as bigint;
    if (sellerVaultAllowance < shareAmount) {
      throw new Error('SELLER_VAULT_ALLOWANCE_REQUIRED');
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
  const operatorKey = resolveOperatorSignerKey();

  if (!treasury || !isAddress(treasury) || !operatorKey) {
    throw new Error('ON_CHAIN_SETTLEMENT_OPERATOR_MISSING');
  }

  const shareAmount = vaultSharesForTokenCount(input.tokenCount);
  if (shareAmount <= 0n) {
    throw new Error('INVALID_TOKEN_COUNT');
  }

  const chainId = asset.chainId ?? 8453;
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const operator = new Wallet(operatorKey, provider);
  const operatorAddress = operator.address;

  try {
    const vaultContract = new Contract(vault, VAULT_ABI, provider);
    const assetContract = new Contract(token, TOKEN_ABI, operator);

    const sellerShareBalance = (await vaultContract.balanceOf(sellerWallet)) as bigint;
    if (sellerShareBalance < shareAmount) {
      throw new Error('INSUFFICIENT_SELLER_ON_CHAIN_SHARES');
    }

    const sellerVaultAllowance = (await vaultContract.allowance(sellerWallet, operatorAddress)) as bigint;
    if (sellerVaultAllowance < shareAmount) {
      throw new Error('SELLER_VAULT_ALLOWANCE_REQUIRED');
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
