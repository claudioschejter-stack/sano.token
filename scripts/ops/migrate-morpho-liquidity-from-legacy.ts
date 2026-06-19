#!/usr/bin/env node
/**
 * Withdraw USDC supply from Morpho Blue (legacy deploy wallet) and transfer to Morpho Liquidity Privy wallet.
 *
 * Usage:
 *   npx tsx scripts/ops/migrate-morpho-liquidity-from-legacy.ts --dry-run
 *   npx tsx scripts/ops/migrate-morpho-liquidity-from-legacy.ts
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, Wallet, formatUnits } from 'ethers';
import { getLendingChainConfig } from '../../apps/web/src/lib/lending/baseContracts';
import {
  buildDefaultMorphoMarketParams,
  morphoMarketId
} from '../../apps/web/src/lib/lending/protocols/morphoBorrow';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../packages/database/.env') });
config({ path: resolve(__dirname, '../../.env') });

const LEGACY_ORACLE = '0x5640A966F960A3Cb22681a186f39337E0355d86B';
const VAULT_ADDRESS = '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089';
const DEFAULT_DEST =
  process.env.MORPHO_LIQUIDITY_ADDRESS?.trim() || '0xa27450116E04eb845d741767d9e798Ccf828fDC1';

const MORPHO_ABI = [
  'function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
  'function withdraw((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn)'
];

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = readFlag('--dry-run');
  const privateKey = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  if (!privateKey) {
    throw new Error('TOKEN_DEPLOY_PRIVATE_KEY required (legacy Morpho supplier wallet).');
  }

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';

  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(privateKey, provider);
  const walletAddress = await wallet.getAddress();
  const dest = DEFAULT_DEST;

  const params = buildDefaultMorphoMarketParams(VAULT_ADDRESS, LEGACY_ORACLE);
  if (!params) {
    throw new Error('Could not build Morpho market params.');
  }

  const { morpho, usdc } = getLendingChainConfig();
  const marketId = morphoMarketId(params);
  const morphoContract = new Contract(morpho, MORPHO_ABI, wallet);
  const usdcContract = new Contract(usdc, ERC20_ABI, wallet);
  const decimals = Number(await usdcContract.decimals());

  const ethBalance = await provider.getBalance(walletAddress);
  const usdcBefore = await usdcContract.balanceOf(walletAddress);
  const position = await morphoContract.position(marketId, walletAddress);
  const supplyShares = BigInt(position.supplyShares ?? position[0] ?? 0);

  console.log('[migrate] legacy wallet', walletAddress);
  console.log('[migrate] dest Morpho liquidity', dest);
  console.log('[migrate] market id', marketId);
  console.log('[migrate] ETH balance', formatUnits(ethBalance, 18));
  console.log('[migrate] USDC wallet balance', formatUnits(usdcBefore, decimals));
  console.log('[migrate] Morpho supply shares', supplyShares.toString());

  if (supplyShares <= 0n) {
    console.log('[migrate] No Morpho Blue supply on legacy market. Nothing to withdraw.');
    if (usdcBefore > 0n) {
      console.log('[migrate] Legacy wallet already holds USDC — will transfer only.');
    } else {
      provider.destroy();
      return;
    }
  }

  if (ethBalance <= 0n && !dryRun) {
    throw new Error(`Legacy wallet ${walletAddress} needs ETH on Base for gas.`);
  }

  if (dryRun) {
    console.log('[migrate] dry-run complete — re-run without --dry-run to execute.');
    provider.destroy();
    return;
  }

  if (supplyShares > 0n) {
    const marketParams = {
      loanToken: params.loanToken,
      collateralToken: params.collateralToken,
      oracle: params.oracle,
      irm: params.irm,
      lltv: params.lltv
    };
    await morphoContract.withdraw.staticCall(marketParams, 0, supplyShares, walletAddress, walletAddress);
    const withdrawTx = await morphoContract.withdraw(
      marketParams,
      0,
      supplyShares,
      walletAddress,
      walletAddress
    );
    const withdrawReceipt = await withdrawTx.wait();
    console.log('[migrate] withdraw tx', withdrawReceipt?.hash ?? withdrawTx.hash);
  }

  const usdcAfterWithdraw = await usdcContract.balanceOf(walletAddress);
  console.log('[migrate] USDC after withdraw', formatUnits(usdcAfterWithdraw, decimals));

  if (usdcAfterWithdraw <= 0n) {
    throw new Error('No USDC available to transfer after withdraw.');
  }

  const transferTx = await usdcContract.transfer(dest, usdcAfterWithdraw);
  const transferReceipt = await transferTx.wait();
  console.log(
    '[migrate] transferred',
    formatUnits(usdcAfterWithdraw, decimals),
    'USDC to',
    dest,
    'tx',
    transferReceipt?.hash ?? transferTx.hash
  );

  const destBalance = await usdcContract.balanceOf(dest);
  console.log('[migrate] dest USDC balance', formatUnits(destBalance, decimals));
  provider.destroy();
}

main().catch((error) => {
  console.error('[migrate] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
