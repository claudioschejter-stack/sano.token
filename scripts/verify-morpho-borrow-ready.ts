#!/usr/bin/env node
/**
 * C — Morpho borrow readiness smoke check (mainnet Urban View).
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const PROJECT_ID = 'proj-apart-hotel-urban-view-anelo-mplonxbv';
const MARKET_ID = '0x81e928e6f75f1c5a7f59a1b3f9d96e856b537fbecb53914e156df346b8f1a00d';

async function main() {
  const { getAdminAsset } = await import('../apps/web/src/lib/admin/assetsService.ts');
  const { buildDefaultMorphoMarketParams, morphoMarketId } = await import(
    '../apps/web/src/lib/lending/protocols/morphoBorrow.ts'
  );
  const { getLendingChainConfig } = await import('../apps/web/src/lib/lending/baseContracts.ts');

  const asset = await getAdminAsset(PROJECT_ID);
  if (!asset) {
    throw new Error('Asset not found');
  }

  const morphoTarget = asset.collateralTargets.find((t) => t.protocol === 'MORPHO');
  const vault = asset.vaultAddress;
  const params = vault ? buildDefaultMorphoMarketParams(vault, morphoTarget?.oracleAddress ?? null) : null;

  console.log('=== C — Morpho borrow readiness ===\n');
  console.log('Project:', asset.title);
  console.log('readyToBorrow:', asset.readyToBorrow);
  console.log('morphoLiquidityStatus:', asset.morphoLiquidityStatus);
  console.log('vault:', vault);
  console.log('morphoStatus:', morphoTarget?.status);
  console.log('marketId:', params ? morphoMarketId(params) : null);

  const rpc = process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  const provider = new JsonRpcProvider(rpc);
  const morphoAddr = getLendingChainConfig().morpho;
  const morphoContract = new Contract(
    morphoAddr,
    ['function market(bytes32 id) view returns (uint128,uint128,uint128,uint128,uint128,uint128)'],
    provider
  );

  const market = await morphoContract.market(MARKET_ID);
  const supply = BigInt(market[0] ?? 0);
  const borrow = BigInt(market[2] ?? 0);
  const available = supply > borrow ? supply - borrow : 0n;
  console.log('\nOn-chain liquidity (USDC base units):', available.toString());

  const ok =
    asset.readyToBorrow &&
    asset.morphoLiquidityStatus === 'LIQUID' &&
    morphoTarget?.status === 'REGISTERED' &&
    available > 0n;

  console.log('\nBorrow UI should work:', ok ? 'YES' : 'NO');

  if (!ok) {
    process.exit(1);
  }

  console.log('\nManual test:');
  console.log('  1. Login → /marketplace (INVESTOR role sees borrow rates)');
  console.log('  2. Connect wallet on Base with vault shares as collateral');
  console.log('  3. Borrow panel → Morpho → enter amount → sign txs');

  provider.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
