import { prisma, Prisma } from '@sanova/database';
import { allocateProjectRentByPreference } from '../investor/rentPayoutService';
import { getAdminAsset } from '../admin/assetsService';
import { appendDeploymentEvent } from '../admin/assetsService';

/** Allocate converted USDC rent to investors by FIAT/USDC preference. */
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
  const chainId = batch.chainId ?? asset?.chainId ?? 8453;

  await prisma.projectYieldBatch.update({
    where: { id: batchId },
    data: { status: 'DISTRIBUTING' }
  });

  const allocation = await allocateProjectRentByPreference({
    projectId: batch.projectId,
    totalAmountUsd: usdcAmount,
    batchId: batch.id,
    chainId,
    sourceCurrency: batch.sourceCurrency,
    idempotencyPrefix: `yield-batch:${batch.id}`
  });

  const completed = await prisma.$transaction(async (txClient) => {
    const updated = await txClient.projectYieldBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
        distributionTxHash: null,
        completedAt: new Date(),
        error: null,
        metadata: {
          ...(batch.metadata as object),
          distributionMode: 'investor_preference_split',
          allocation
        } as Prisma.InputJsonObject
      }
    });

    await txClient.payoutHistory.create({
      data: {
        projectId: batch.projectId,
        totalAmountPaid: usdcAmount,
        liquidPaidUsd: usdcAmount,
        status: 'SUCCESS',
        debtOffsetUsd: 0,
        txHash: `yield-batch:${batch.id}`
      }
    });

    return updated;
  });

  await appendDeploymentEvent(batch.projectId, {
    step: 'YIELD_DISTRIBUTE',
    status: 'SUCCESS',
    message: `Yield ${usdcAmount} USD repartido según preferencia FIAT/USDC de inversores.`,
    externalId: batchId
  }).catch(() => undefined);

  return completed;
}
