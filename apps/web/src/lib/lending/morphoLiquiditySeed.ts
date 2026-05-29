import { Contract, JsonRpcProvider, Wallet, MaxUint256 } from 'ethers';
import type { MorphoMarketParams } from './protocols/morphoBorrow';
import { getLendingChainConfig } from './baseContracts';

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

/** Optionally seed Morpho USDC liquidity when operator wallet has balance. */
export async function seedMorphoLiquidityIfConfigured(params: MorphoMarketParams): Promise<string | null> {
  const usdcAmount = Number(process.env.MORPHO_SEED_LIQUIDITY_USDC ?? '0');
  if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
    return null;
  }

  const privateKey = process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim();
  if (!privateKey) {
    return null;
  }

  const provider = new JsonRpcProvider(resolveRpcUrl());
  const wallet = new Wallet(privateKey, provider);
  const { morpho, usdc } = getLendingChainConfig();
  const usdcContract = new Contract(usdc, ERC20_ABI, wallet);
  const decimals = await usdcContract.decimals();
  const amount = BigInt(Math.floor(usdcAmount * 10 ** Number(decimals)));
  const balance = await usdcContract.balanceOf(wallet.address);
  if (balance < amount) {
    provider.destroy();
    return null;
  }

  const approveTx = await usdcContract.approve(morpho, MaxUint256);
  await approveTx.wait();
  const morphoContract = new Contract(morpho, MORPHO_SUPPLY_ABI, wallet);
  const supplyTx = await morphoContract.supply(
    [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv],
    amount,
    0,
    wallet.address,
    '0x'
  );
  const receipt = await supplyTx.wait();
  provider.destroy();
  return receipt?.hash ?? supplyTx.hash;
}
