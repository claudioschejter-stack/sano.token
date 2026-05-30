import { enqueueAutomationJob, processAutomationJobs } from '../admin/automationJobs';
import { processYieldBatchConversion } from './yieldConversionService';
import { distributeUsdcToProjectVault } from './yieldVaultDistribution';
import { prisma } from '@sanova/database';

export async function enqueueYieldBatchJobs(batchId: string) {
  const batch = await prisma.projectYieldBatch.findUnique({ where: { id: batchId } });
  await enqueueAutomationJob({
    projectId: batch?.projectId ?? null,
    step: 'YIELD_CONVERT_BATCH',
    payload: { batchId },
    maxAttempts: 5
  });
}

export async function enqueueYieldDistributionJob(batchId: string) {
  const batch = await prisma.projectYieldBatch.findUnique({ where: { id: batchId } });
  await enqueueAutomationJob({
    projectId: batch?.projectId ?? null,
    step: 'YIELD_DISTRIBUTE_VAULT',
    payload: { batchId },
    maxAttempts: 5
  });
}

export async function executeYieldAutomationJob(job: {
  step: string;
  payload: Record<string, unknown> | null;
}) {
  const batchId = typeof job.payload?.batchId === 'string' ? job.payload.batchId : null;
  if (!batchId) throw new Error('YIELD_JOB_MISSING_BATCH_ID');

  if (job.step === 'YIELD_CONVERT_BATCH') {
    return processYieldBatchConversion(batchId);
  }

  if (job.step === 'YIELD_DISTRIBUTE_VAULT') {
    return distributeUsdcToProjectVault(batchId);
  }

  throw new Error(`UNKNOWN_YIELD_JOB:${job.step}`);
}

export async function processDueYieldBatches(limit = 10) {
  return processAutomationJobs(limit);
}

export async function autoEnqueueEligibleYieldBatches() {
  const { listProjectsReadyForYieldConversion, createYieldBatchFromOperatingBalance } = await import(
    './projectOperatingService'
  );
  const ready = await listProjectsReadyForYieldConversion(20);
  const queued = [];

  for (const account of ready) {
    try {
      const batch = await createYieldBatchFromOperatingBalance({
        projectId: account.projectId,
        currency: account.currency
      });
      queued.push({ projectId: account.projectId, batchId: batch.id, currency: account.currency });
    } catch (error) {
      queued.push({
        projectId: account.projectId,
        error: error instanceof Error ? error.message : 'enqueue failed',
        currency: account.currency
      });
    }
  }

  return queued;
}
