import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getAdminAsset, updateAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { registerProjectCollateral } from '../apps/web/src/lib/collateral/collateralOrchestrator';
import { checkMorphoLiquidity } from '../apps/web/src/lib/lending/morphoLiquidityCheck';
import { buildSmartContractDocUrl } from '../apps/web/src/lib/blockchain/explorerUrls';

const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function kycApproved(address) view returns (bool)',
  'function externalContractAllowed(address) view returns (bool)',
  'function setExternalContractAllowed(address,bool)',
  'function setKyc(address,bool)',
  'function owner() view returns (address)'
];
const VAULT_ABI = [
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
  'function totalAssets() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function externalContractAllowed(address) view returns (bool)',
  'function setExternalContractAllowed(address,bool)'
];

async function main() {
  const projectId = process.argv[2] ?? 'proj-apart-hotel-urban-view-anelo-mplonxbv';
  const tokenAddress = process.argv[3] ?? '0x1dD753e74C68E5Acfa4846D5336e7D552C999664';
  const vaultAddress = process.argv[4] ?? '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089';
  const chainId = 8453;

  const privateKey = process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim();
  const treasury = process.env.TOKEN_TREASURY_ADDRESS?.trim();
  if (!privateKey || !treasury) throw new Error('Missing TOKEN_DEPLOY_PRIVATE_KEY or TOKEN_TREASURY_ADDRESS');

  const rpc = process.env.LENDING_BASE_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(privateKey, provider);
  const asset = new Contract(tokenAddress, TOKEN_ABI, wallet);
  const vault = new Contract(vaultAddress, VAULT_ABI, wallet);

  const balance = await asset.balanceOf(wallet.address);
  console.log('[fund] deployer token balance', balance.toString());
  if (balance === 0n) throw new Error('Deployer has no tokens to deposit');

  const treasuryKyc = await asset.kycApproved(treasury);
  console.log('[fund] treasury KYC', treasuryKyc);
  if (!treasuryKyc) throw new Error('Treasury lacks KYC on token — fund via Safe setKyc first');

  const vaultKyc = await asset.kycApproved(vaultAddress);
  if (!vaultKyc) {
    console.log('[fund] setting vault KYC on asset');
    await (await asset.setKyc(vaultAddress, true)).wait();
  }
  if (!(await asset.externalContractAllowed(vaultAddress))) {
    console.log('[fund] allowing vault on asset');
    await (await asset.setExternalContractAllowed(vaultAddress, true)).wait();
  }
  if (!(await vault.externalContractAllowed(treasury))) {
    console.log('[fund] allowing treasury on vault shares');
    await (await vault.setExternalContractAllowed(treasury, true)).wait();
  }

  const approveTx = await asset.approve(vaultAddress, balance);
  await approveTx.wait();
  const depositTx = await vault.deposit(balance, treasury);
  const receipt = await depositTx.wait();
  console.log('[fund] deposit tx', receipt?.hash ?? depositTx.hash);

  const totalAssets = await vault.totalAssets();
  const shares = await vault.balanceOf(treasury);
  console.log('[fund] vault totalAssets', totalAssets.toString(), 'treasury shares', shares.toString());

  const vaultExplorerUrl = buildSmartContractDocUrl(chainId, vaultAddress) ?? vaultAddress;
  await updateAdminAsset(projectId, {
    contractAddress: tokenAddress,
    vaultAddress,
    chainId,
    tokenDeployStatus: 'DEPLOYED',
    vaultFundingStatus: 'FUNDED',
    vaultFundingAmount: balance.toString(),
    vaultFundingTxHash: receipt?.hash ?? depositTx.hash,
    vaultFundingError: null,
    explorerVerificationStatus: 'VERIFIED',
    contracts: { smartContract: vaultExplorerUrl }
  });

  const reg = await registerProjectCollateral(projectId, ['MORPHO']);
  console.log('[fund] morpho registration', reg?.outcomes);
  const assetRecord = reg?.updatedAsset ?? (await getAdminAsset(projectId));
  if (assetRecord) {
    const liq = await checkMorphoLiquidity(assetRecord);
    console.log('[fund] liquidity', liq);
    console.log('[fund] final', {
      readyToBorrow: (await getAdminAsset(projectId))?.readyToBorrow,
      morpho: (await getAdminAsset(projectId))?.collateralTargets.find((t) => t.protocol === 'MORPHO')
    });
  }

  provider.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
