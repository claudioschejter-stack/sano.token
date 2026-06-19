#!/usr/bin/env node
/** Supply all USDC from Morpho Liquidity Privy wallet into NAV market (no DB). */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, MaxUint256, formatUnits } from 'ethers';
import { resolveMorphoLiquiditySigner } from '../../apps/web/src/lib/blockchain/morphoLiquiditySigner';
import { buildDefaultMorphoMarketParams } from '../../apps/web/src/lib/lending/protocols/morphoBorrow';
import { getLendingChainConfig } from '../../apps/web/src/lib/lending/baseContracts';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const VAULT = '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089';
const NAV_ORACLE = '0x2C56D06CbE212eB7343C3652D57A4C0E5976C257';
const NAV_MARKET_ID =
  '0x114aee5443b74e9527c14fad35968a4fe98090941888fc8c8a88d4c33c3936e7';

const MORPHO_SUPPLY_ABI = [
  'function supply((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsSupplied, uint256 sharesSupplied)'
];
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

async function main() {
  process.env.MORPHO_LIQUIDITY_ADDRESS =
    process.env.MORPHO_LIQUIDITY_ADDRESS?.trim() || '0xa27450116E04eb845d741767d9e798Ccf828fDC1';

  const params = buildDefaultMorphoMarketParams(VAULT, NAV_ORACLE);
  if (!params) throw new Error('bad market params');

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';
  const chainId = getLendingChainConfig().chainId;
  const provider = new JsonRpcProvider(rpc);
  const wallet = await resolveMorphoLiquiditySigner(provider, chainId);
  if (!wallet) throw new Error('Privy Morpho signer not configured');

  const walletAddress = await wallet.getAddress();
  const { morpho, usdc } = getLendingChainConfig();
  const usdcContract = new Contract(usdc, ERC20_ABI, wallet);
  const decimals = Number(await usdcContract.decimals());
  const usdcBalance = await usdcContract.balanceOf(walletAddress);
  const ethBalance = await provider.getBalance(walletAddress);

  console.log('[supply-privy] wallet', walletAddress);
  console.log('[supply-privy] USDC', formatUnits(usdcBalance, decimals));
  console.log('[supply-privy] ETH', formatUnits(ethBalance, 18));
  console.log('[supply-privy] market', NAV_MARKET_ID);

  if (ethBalance <= 0n) throw new Error('no ETH for gas');
  if (usdcBalance <= 0n) throw new Error('no USDC to supply');

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

  await morphoContract.supply.staticCall(marketParams, usdcBalance, 0, walletAddress, '0x');
  const supplyTx = await morphoContract.supply(marketParams, usdcBalance, 0, walletAddress, '0x');
  const receipt = await supplyTx.wait();
  console.log('[supply-privy] tx', receipt?.hash ?? supplyTx.hash);
  provider.destroy();
}

main().catch((error) => {
  console.error('[supply-privy] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
