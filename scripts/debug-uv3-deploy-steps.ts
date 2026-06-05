#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import SanovaAssetTokenArtifact from '../apps/web/src/lib/blockchain/artifacts/SanovaAssetToken.json';
import SanovaRwaVaultArtifact from '../apps/web/src/lib/blockchain/artifacts/SanovaRwaVault.json';
import { resolveTreasuryAddress } from '../apps/web/src/lib/blockchain/treasuryPolicy';
import { waitForAutomationTx } from '../apps/web/src/lib/blockchain/automationTx';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });

async function step(name: string, fn: () => Promise<void>) {
  process.stdout.write(`[step] ${name}... `);
  try {
    await fn();
    console.log('OK');
  } catch (error) {
    console.log('FAIL');
    throw error;
  }
}

async function main() {
  const privateKey = process.env.TOKEN_DEPLOY_PRIVATE_KEY!.trim();
  const provider = new JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new Wallet(privateKey, provider);
  const treasury = resolveTreasuryAddress()!;
  const mintAmount = 5000n * 10n ** 18n;

  const assetFactory = new ContractFactory(
    SanovaAssetTokenArtifact.abi,
    SanovaAssetTokenArtifact.bytecode,
    wallet
  );

  let assetAddress = '';
  let vaultAddress = '';

  await step('deploy asset', async () => {
    const assetToken = await assetFactory.deploy('ANELO UV3 RWA Equity', 'UV3RWA', wallet.address);
    await assetToken.waitForDeployment();
    assetAddress = await assetToken.getAddress();
    console.log(`\n       asset=${assetAddress}`);
  });

  const asset = new Contract(assetAddress, SanovaAssetTokenArtifact.abi, wallet);

  await step('mint', async () => {
    const tx = await asset.mint(wallet.address, mintAmount);
    await waitForAutomationTx(tx);
  });

  await step('deploy vault', async () => {
    const vaultFactory = new ContractFactory(
      SanovaRwaVaultArtifact.abi,
      SanovaRwaVaultArtifact.bytecode,
      wallet
    );
    const vault = await vaultFactory.deploy(
      assetAddress,
      'ANELO UV3 RWA Equity Vault',
      'vUV3RWA',
      wallet.address
    );
    await vault.waitForDeployment();
    vaultAddress = await vault.getAddress();
    console.log(`\n       vault=${vaultAddress}`);
  });

  const vault = new Contract(vaultAddress, SanovaRwaVaultArtifact.abi, wallet);

  await step('set vault kyc on asset', async () => {
    const tx = await asset.setKyc(vaultAddress, true);
    await waitForAutomationTx(tx);
  });

  await step('set treasury kyc', async () => {
    const tx = await asset.setKyc(treasury, true);
    await waitForAutomationTx(tx);
  });

  await step('allow vault on asset', async () => {
    const tx = await asset.setExternalContractAllowed(vaultAddress, true);
    await waitForAutomationTx(tx);
  });

  await step('allow treasury on vault', async () => {
    const tx = await vault.setExternalContractAllowed(treasury, true);
    await waitForAutomationTx(tx);
  });

  await step('approve + deposit', async () => {
    await waitForAutomationTx(await asset.approve(vaultAddress, mintAmount));
    await waitForAutomationTx(await vault.deposit(mintAmount, treasury));
  });

  console.log('\nAll steps OK');
  provider.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
