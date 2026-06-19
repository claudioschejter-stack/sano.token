#!/usr/bin/env node
/** Sweep remaining Base ETH from legacy deploy wallet to Morpho Liquidity Privy wallet. */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, Wallet, formatUnits } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../packages/database/.env') });
config({ path: resolve(__dirname, '../../.env') });

const DEST =
  process.env.MORPHO_LIQUIDITY_ADDRESS?.trim() || '0xa27450116E04eb845d741767d9e798Ccf828fDC1';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const privateKey = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  if (!privateKey) throw new Error('TOKEN_DEPLOY_PRIVATE_KEY required');

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';
  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(privateKey, provider);
  const from = await wallet.getAddress();
  const fee = await provider.getFeeData();
  const gasPrice = fee.maxFeePerGas ?? fee.gasPrice ?? 1_000_000n;
  const gasLimit = 21_000n;
  const reserve = (gasPrice * gasLimit * 12n) / 10n;
  const balance = await provider.getBalance(from);
  const sendValue = balance > reserve ? balance - reserve : 0n;

  console.log('[sweep] from', from);
  console.log('[sweep] to', DEST);
  console.log('[sweep] balance ETH', formatUnits(balance, 18));
  console.log('[sweep] send ETH', formatUnits(sendValue, 18));

  if (sendValue <= 0n) {
    console.log('[sweep] nothing to send');
    provider.destroy();
    return;
  }

  if (dryRun) {
    console.log('[sweep] dry-run ok');
    provider.destroy();
    return;
  }

  const tx = await wallet.sendTransaction({ to: DEST, value: sendValue });
  const receipt = await tx.wait();
  console.log('[sweep] tx', receipt?.hash ?? tx.hash);
  console.log('[sweep] dest ETH', formatUnits(await provider.getBalance(DEST), 18));
  provider.destroy();
}

main().catch((error) => {
  console.error('[sweep] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
