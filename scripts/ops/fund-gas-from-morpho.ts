#!/usr/bin/env node
/** Send Base ETH from Morpho Privy wallet to fund gas. Run with production env:
 *   cd apps/web && npx vercel env run production -- npx tsx ../../scripts/ops/fund-gas-from-morpho.ts 0xA00f...
 */
import { JsonRpcProvider, formatEther, isAddress } from 'ethers';
import { resolveMorphoLiquiditySigner } from '../../apps/web/src/lib/blockchain/morphoLiquiditySigner';
import { getLendingChainConfig } from '../../apps/web/src/lib/lending/baseContracts';

const DEFAULT_TOPUP = 5_000_000_000_000_000n; // 0.005 ETH

async function main() {
  const to = process.argv[2]?.trim();
  if (!to || !isAddress(to)) {
    throw new Error('Usage: fund-gas-from-morpho.ts <0x recipient>');
  }

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';
  const chainId = getLendingChainConfig().chainId;
  const provider = new JsonRpcProvider(rpc);

  const signer = await resolveMorphoLiquiditySigner(provider, chainId);
  if (!signer) throw new Error('Morpho Privy signer not configured');

  const from = await signer.getAddress();
  const balanceBefore = await provider.getBalance(from);
  const recipientBefore = await provider.getBalance(to);

  console.log('From (Morpho):', from, formatEther(balanceBefore), 'ETH');
  console.log('To:', to, formatEther(recipientBefore), 'ETH');
  console.log('Sending:', formatEther(DEFAULT_TOPUP), 'ETH');

  if (balanceBefore <= DEFAULT_TOPUP) {
    throw new Error('Morpho wallet insufficient ETH');
  }

  const tx = await signer.sendTransaction({ to, value: DEFAULT_TOPUP });
  console.log('Broadcast:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed:', receipt?.hash ?? tx.hash);

  const recipientAfter = await provider.getBalance(to);
  console.log('Recipient balance now:', formatEther(recipientAfter), 'ETH');
  provider.destroy();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
