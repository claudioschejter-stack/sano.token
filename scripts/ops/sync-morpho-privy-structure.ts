#!/usr/bin/env node
/**
 * Register NAV Morpho market for Añelo, supply USDC from Morpho Liquidity Privy wallet, verify borrow readiness.
 *
 * Loads Privy env from apps/web/.env.privy.tmp if present (vercel env pull).
 */
import { config } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const privyEnv = resolve(root, 'apps/web/.env.privy.tmp');

config({ path: resolve(root, 'packages/database/.env') });
config({ path: resolve(root, '.env') });

function applyPrivyEnvOnly(path: string) {
  if (!existsSync(path)) return;
  const keys = new Set([
    'PRIVY_APP_SECRET',
    'NEXT_PUBLIC_PRIVY_APP_ID',
    'PRIVY_MORPHO_LIQUIDITY_WALLET_ID',
    'MORPHO_LIQUIDITY_ADDRESS',
    'PRIVY_OPERATOR_WALLET_ID',
    'RWA_OPERATOR_ADDRESS'
  ]);
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!keys.has(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) process.env[key] = value;
  }
}

applyPrivyEnvOnly(privyEnv);
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

process.env.MORPHO_ORACLE_TYPE = process.env.MORPHO_ORACLE_TYPE?.trim() || 'nav';
process.env.MORPHO_ORACLE_ADDRESS =
  process.env.MORPHO_ORACLE_ADDRESS?.trim() || '0x2C56D06CbE212eB7343C3652D57A4C0E5976C257';
process.env.MORPHO_LIQUIDITY_ADDRESS =
  process.env.MORPHO_LIQUIDITY_ADDRESS?.trim() || '0xa27450116E04eb845d741767d9e798Ccf828fDC1';

import { Contract, JsonRpcProvider, MaxUint256, formatUnits } from 'ethers';
import { getAdminAsset, updateAdminAsset } from '../../apps/web/src/lib/admin/assetsService';
import { resolveMorphoLiquiditySigner } from '../../apps/web/src/lib/blockchain/morphoLiquiditySigner';
import { checkMorphoLiquidity } from '../../apps/web/src/lib/lending/morphoLiquidityCheck';
import { buildDefaultMorphoMarketParams, morphoMarketId } from '../../apps/web/src/lib/lending/protocols/morphoBorrow';
import { getLendingChainConfig } from '../../apps/web/src/lib/lending/baseContracts';

const PROJECT_ID = process.argv[2] ?? 'proj-apart-hotel-urban-view-anelo-mplonxbv';
const NAV_MARKET_ID =
  '0x114aee5443b74e9527c14fad35968a4fe98090941888fc8c8a88d4c33c3936e7';
const NAV_ORACLE = '0x2C56D06CbE212eB7343C3652D57A4C0E5976C257';

const MORPHO_SUPPLY_ABI = [
  'function supply((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsSupplied, uint256 sharesSupplied)'
];
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    config({ path: resolve(root, 'packages/database/.env'), override: true });
    if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;
  }

  const asset = await getAdminAsset(PROJECT_ID);
  if (!asset?.vaultAddress) throw new Error('Vault not deployed');

  console.log('[sync] vault', asset.vaultAddress);
  console.log('[sync] NAV market', NAV_MARKET_ID);
  console.log('[sync] NAV oracle', NAV_ORACLE);
  console.log('[sync] privy morpho configured', Boolean(process.env.PRIVY_MORPHO_LIQUIDITY_WALLET_ID && process.env.PRIVY_APP_SECRET));

  const params = buildDefaultMorphoMarketParams(asset.vaultAddress, NAV_ORACLE);
  if (!params) throw new Error('Could not build NAV market params');
  const marketId = morphoMarketId(params);
  if (marketId.toLowerCase() !== NAV_MARKET_ID.toLowerCase()) {
    throw new Error(`NAV market id mismatch: expected ${NAV_MARKET_ID}, got ${marketId}`);
  }

  await updateAdminAsset(PROJECT_ID, {
    morphoLiquidityStatus: 'PENDING',
    collateralTargets: [
      {
        protocol: 'MORPHO',
        status: 'REGISTERED',
        readinessScore: 100,
        missingRequirements: [],
        externalId: NAV_MARKET_ID,
        poolUrl: `https://app.morpho.org/base/market/${NAV_MARKET_ID}`,
        oracleAddress: NAV_ORACLE,
        notes: `Mercado Morpho NAV — liquidez vía Privy ${process.env.MORPHO_LIQUIDITY_ADDRESS}.`,
        submittedAt: new Date().toISOString(),
        registeredAt: new Date().toISOString(),
        lastError: null
      }
    ]
  });
  console.log('[sync] admin asset updated to NAV market');

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';
  const chainId = getLendingChainConfig().chainId;
  const provider = new JsonRpcProvider(rpc);
  const wallet = await resolveMorphoLiquiditySigner(provider, chainId);
  if (!wallet) {
    throw new Error('Privy Morpho liquidity signer not configured (PRIVY_MORPHO_LIQUIDITY_WALLET_ID + MORPHO_LIQUIDITY_ADDRESS + PRIVY_APP_SECRET).');
  }

  const walletAddress = await wallet.getAddress();
  const { morpho, usdc } = getLendingChainConfig();
  const usdcContract = new Contract(usdc, ERC20_ABI, wallet);
  const decimals = Number(await usdcContract.decimals());
  const usdcBalance = await usdcContract.balanceOf(walletAddress);
  const ethBalance = await provider.getBalance(walletAddress);

  console.log('[sync] liquidity wallet', walletAddress);
  console.log('[sync] USDC balance', formatUnits(usdcBalance, decimals));
  console.log('[sync] ETH balance', formatUnits(ethBalance, 18));

  if (ethBalance <= 0n) throw new Error('Morpho liquidity wallet needs ETH on Base for supply gas.');
  if (usdcBalance <= 0n) throw new Error('Morpho liquidity wallet has no USDC to supply.');

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
  const supplyReceipt = await supplyTx.wait();
  console.log('[sync] supplied USDC tx', supplyReceipt?.hash ?? supplyTx.hash);
  console.log('[sync] market id', marketId);

  const refreshed = await getAdminAsset(PROJECT_ID);
  if (refreshed) {
    const liq = await checkMorphoLiquidity(refreshed);
    const finalAsset = await getAdminAsset(PROJECT_ID);
    console.log('[sync] liquidity check', liq);
    console.log('[sync] readyToBorrow', finalAsset?.readyToBorrow);
    console.log('[sync] morphoLiquidityStatus', finalAsset?.morphoLiquidityStatus);
  }

  provider.destroy();
}

main().catch((error) => {
  console.error('[sync] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
