import { prisma, Prisma } from '@sanova/database';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { getAdminAsset } from '../admin/assetsService';
import { appendDeploymentEvent } from '../admin/assetsService';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || process.env.LENDING_BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  }
  throw new Error(`UNSUPPORTED_CHAIN:${chainId}`);
}

/** Accrue USDC yield to property vault (raises NAV for all share holders). */
export async function distributeUsdcToProjectVault(batchId: string) {
  const batch = await prisma.projectYieldBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error('BATCH_NOT_FOUND');
  if (batch.status === 'COMPLETED') return batch;
  if (batch.status !== 'USDC_READY' && batch.status !== 'DISTRIBUTING') {
    throw new Error(`BATCH_NOT_READY:${batch.status}`);
  }

  const usdcAmount = batch.usdcAmount?.toNumber() ?? 0;
  if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) throw new Error('USDC_AMOUNT_MISSING');

  const asset = await getAdminAsset(batch.projectId);
  const vaultAddress = batch.vaultAddress ?? asset?.vaultAddress;
  const chainId = batch.chainId ?? asset?.chainId ?? 8453;
  if (!vaultAddress) throw new Error('VAULT_NOT_CONFIGURED');

  const privateKey = process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error('TOKEN_DEPLOY_PRIVATE_KEY_REQUIRED');

  const usdcAddress =
    process.env.BASE_USDC_TOKEN_ADDRESS?.trim() || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  await prisma.projectYieldBatch.update({
    where: { id: batchId },
    data: { status: 'DISTRIBUTING', vaultAddress, chainId }
  });

  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const wallet = new Wallet(privateKey, provider);
  const usdc = new Contract(usdcAddress, ERC20_ABI, wallet);
  const decimals = Number(await usdc.decimals());
  const amountBaseUnits = BigInt(Math.floor(usdcAmount * 10 ** decimals));

  const balance = await usdc.balanceOf(wallet.address);
  if (balance < amountBaseUnits) {
    throw new Error(`INSUFFICIENT_OPERATOR_USDC: need ${amountBaseUnits}, have ${balance}`);
  }

  const tx = await usdc.transfer(vaultAddress, amountBaseUnits);
  const receipt = await tx.wait();
  const txHash = receipt?.hash ?? tx.hash;

  const completed = await prisma.$transaction(async (txClient) => {
    const updated = await txClient.projectYieldBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
        distributionTxHash: txHash,
        completedAt: new Date(),
        error: null,
        metadata: {
          ...(batch.metadata as object),
          distributionMode: 'vault_nav_accrual'
        } as Prisma.InputJsonObject
      }
    });

    await txClient.payoutHistory.create({
      data: {
        projectId: batch.projectId,
        totalAmountPaid: usdcAmount,
        liquidPaidUsd: usdcAmount,
        txHash,
        status: 'SUCCESS',
        debtOffsetUsd: 0
      }
    });

    return updated;
  });

  await appendDeploymentEvent(batch.projectId, {
    step: 'YIELD_DISTRIBUTE',
    status: 'SUCCESS',
    message: `Yield ${usdcAmount} USDC acreditado al vault (NAV).`,
    txHash,
    externalId: batchId
  }).catch(() => undefined);

  provider.destroy();
  return completed;
}
