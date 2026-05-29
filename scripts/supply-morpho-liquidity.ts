import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, Interface, JsonRpcProvider, Wallet, MaxUint256 } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { buildDefaultMorphoMarketParams } from '../apps/web/src/lib/lending/protocols/morphoBorrow';
import { getLendingChainConfig } from '../apps/web/src/lib/lending/baseContracts';
import { checkMorphoLiquidity } from '../apps/web/src/lib/lending/morphoLiquidityCheck';

const MORPHO_SUPPLY_ABI = [
  'function supply((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsSupplied, uint256 sharesSupplied)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  const projectId = readArg('--project-id') ?? 'proj-apart-hotel-urban-view-anelo-mplonxbv';
  const usdcAmount = readArg('--usdc') ?? '1000';

  const asset = await getAdminAsset(projectId);
  if (!asset?.vaultAddress) throw new Error('Vault not deployed');

  const morphoTarget = asset.collateralTargets.find((t) => t.protocol === 'MORPHO');
  if (!morphoTarget?.oracleAddress) throw new Error('Morpho market not registered');

  const params = buildDefaultMorphoMarketParams(asset.vaultAddress, morphoTarget.oracleAddress);
  if (!params) throw new Error('Could not build Morpho market params');

  const privateKey = process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error('TOKEN_DEPLOY_PRIVATE_KEY required');

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';
  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(privateKey, provider);
  const { morpho, usdc } = getLendingChainConfig();

  const usdcContract = new Contract(usdc, ERC20_ABI, wallet);
  const decimals = await usdcContract.decimals();
  const amount = BigInt(Math.floor(Number(usdcAmount) * 10 ** Number(decimals)));

  const balance = await usdcContract.balanceOf(wallet.address);
  console.log(`[supply] wallet ${wallet.address} USDC balance: ${balance.toString()}`);
  if (balance < amount) {
    throw new Error(`Insufficient USDC. Need ${amount}, have ${balance}`);
  }

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
  await morphoContract.supply.staticCall(marketParams, amount, 0, wallet.address, '0x');
  const supplyTx = await morphoContract.supply(marketParams, amount, 0, wallet.address, '0x');
  const receipt = await supplyTx.wait();
  console.log(`[supply] Supplied ${usdcAmount} USDC — tx ${receipt?.hash ?? supplyTx.hash}`);

  const liq = await checkMorphoLiquidity(asset);
  console.log('[supply] liquidity check', liq);
  console.log('[supply] readyToBorrow', (await getAdminAsset(projectId))?.readyToBorrow);

  provider.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
