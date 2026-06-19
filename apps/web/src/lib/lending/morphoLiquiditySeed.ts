import { Contract, JsonRpcProvider, MaxUint256 } from 'ethers';
import type { MorphoMarketParams } from './protocols/morphoBorrow';
import { getLendingChainConfig } from './baseContracts';
import { resolveMorphoSeedUsdcForProject } from './morphoSeedLiquidity';
import { resolveMorphoLiquiditySigner } from '../blockchain/morphoLiquiditySigner';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

const MORPHO_SUPPLY_ABI = [
  'function supply((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsSupplied, uint256 sharesSupplied)'
];

function resolveRpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

export type MorphoLiquiditySeedResult = {
  txHash: string | null;
  targetUsdc: number;
  seededUsdc?: number;
  partial?: boolean;
  skippedReason?: string;
};

/** Seed Morpho USDC liquidity from treasury when wallet balance allows. */
export async function seedMorphoLiquidityIfConfigured(
  params: MorphoMarketParams,
  project?: { totalTokens: number; pricePerToken: number }
): Promise<MorphoLiquiditySeedResult> {
  const usdcAmount = project
    ? resolveMorphoSeedUsdcForProject({
        totalTokens: project.totalTokens,
        pricePerToken: project.pricePerToken
      })
    : Number(process.env.MORPHO_SEED_LIQUIDITY_USDC ?? '0');

  if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
    return { txHash: null, targetUsdc: 0, skippedReason: 'ZERO_SEED_TARGET' };
  }

  const provider = new JsonRpcProvider(resolveRpcUrl());
  const chainId = getLendingChainConfig().chainId;
  const wallet = await resolveMorphoLiquiditySigner(provider, chainId);
  if (!wallet) {
    provider.destroy();
    return {
      txHash: null,
      targetUsdc: usdcAmount,
      skippedReason: 'MORPHO_LIQUIDITY_SIGNER_NOT_CONFIGURED'
    };
  }

  const walletAddress = await wallet.getAddress();
  const { morpho, usdc } = getLendingChainConfig();
  const usdcContract = new Contract(usdc, ERC20_ABI, wallet);
  const decimals = await usdcContract.decimals();
  const amount = BigInt(Math.floor(usdcAmount * 10 ** Number(decimals)));
  const balance = await usdcContract.balanceOf(walletAddress);
  if (balance <= 0n) {
    provider.destroy();
    return { txHash: null, targetUsdc: usdcAmount, skippedReason: 'INSUFFICIENT_TREASURY_USDC' };
  }

  const seedAmount = balance < amount ? balance : amount;
  const seededUsd = Number(seedAmount) / 10 ** Number(decimals);

  const approveTx = await usdcContract.approve(morpho, MaxUint256);
  await approveTx.wait();
  const morphoContract = new Contract(morpho, MORPHO_SUPPLY_ABI, wallet);
  const marketParams = {
    loanToken: params.loanToken,
    collateralToken: params.collateralToken,
    oracle: params.oracle,
    irm: params.irm,
    lltv: params.lltv
  };
  await morphoContract.supply.staticCall(marketParams, seedAmount, 0, walletAddress, '0x');
  const supplyTx = await morphoContract.supply(marketParams, seedAmount, 0, walletAddress, '0x');
  const receipt = await supplyTx.wait();
  provider.destroy();
  return {
    txHash: receipt?.hash ?? supplyTx.hash,
    targetUsdc: usdcAmount,
    seededUsdc: seededUsd,
    partial: seedAmount < amount
  };
}
