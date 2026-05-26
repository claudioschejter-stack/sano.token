import { prisma } from '@sanova/database';
import { appendDeploymentEvent, getAdminAsset } from './assetsService';
import type { DeploymentEvent } from './launchTypes';

export type AutomationJobStep =
  | 'PREFLIGHT'
  | 'TOKEN_DEPLOY'
  | 'VAULT_DEPLOY'
  | 'COLLATERAL_REGISTER'
  | 'MORPHO_LIQUIDITY'
  | 'EXPLORER_VERIFY'
  | 'SYNTHETIC_RWA_FLOW';

export type AutomationJobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'RETRY' | 'FAILED';

type AutomationJobRow = {
  id: string;
  projectId: string | null;
  step: AutomationJobStep;
  status: AutomationJobStatus;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown> | null;
};

type AutomationJobDelegate = {
  create: (args: unknown) => Promise<AutomationJobRow>;
  findMany: (args: unknown) => Promise<AutomationJobRow[]>;
  update: (args: unknown) => Promise<AutomationJobRow>;
};

function jobDelegate(): AutomationJobDelegate | null {
  return (prisma as unknown as { automationJob?: AutomationJobDelegate }).automationJob ?? null;
}

function jobStepToEventStep(step: AutomationJobStep): DeploymentEvent['step'] {
  return step === 'SYNTHETIC_RWA_FLOW' ? 'SYNTHETIC_RWA_FLOW' : step;
}

function retryAt(attempts: number): Date {
  const delayMinutes = Math.min(60, Math.max(1, attempts * attempts * 5));
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

export async function enqueueAutomationJob(input: {
  projectId?: string | null;
  step: AutomationJobStep;
  payload?: Record<string, unknown>;
  runAfter?: Date;
  maxAttempts?: number;
}) {
  const delegate = jobDelegate();
  if (!delegate) {
    if (input.projectId) {
      await appendDeploymentEvent(input.projectId, {
        step: jobStepToEventStep(input.step),
        status: 'PENDING',
        message: `Job ${input.step} pendiente; tabla AutomationJob no disponible todavía.`,
        externalId: 'AUTOMATION_JOB_FALLBACK'
      }).catch(() => undefined);
    }
    return null;
  }

  try {
    return await delegate.create({
      data: {
        projectId: input.projectId ?? null,
        step: input.step,
        status: 'QUEUED',
        payload: input.payload ?? {},
        runAfter: input.runAfter ?? new Date(),
        maxAttempts: input.maxAttempts ?? 3
      }
    });
  } catch (error) {
    if (input.projectId) {
      await appendDeploymentEvent(input.projectId, {
        step: jobStepToEventStep(input.step),
        status: 'PENDING',
        message: `Job ${input.step} registrado en fallback JSON: ${error instanceof Error ? error.message : 'DB unavailable'}`,
        externalId: 'AUTOMATION_JOB_FALLBACK'
      }).catch(() => undefined);
    }
    return null;
  }
}

async function executeAutomationJob(job: AutomationJobRow) {
  if (job.step === 'SYNTHETIC_RWA_FLOW') {
    const { runSyntheticRwaFlow } = await import('./syntheticRwaFlow');
    return runSyntheticRwaFlow({ projectId: job.projectId ?? undefined, createDemo: !job.projectId });
  }

  if (!job.projectId) {
    throw new Error(`${job.step} requires projectId`);
  }

  if (job.step === 'PREFLIGHT') {
    const asset = await getAdminAsset(job.projectId);
    if (!asset) throw new Error('Asset not found');
    const { recordAutomationPreflight } = await import('../blockchain/automationPreflight');
    return recordAutomationPreflight(job.projectId, asset, { persistJob: false });
  }

  if (job.step === 'TOKEN_DEPLOY') {
    const { executeProjectTokenDeploy } = await import('../blockchain/projectTokenDeploy');
    return executeProjectTokenDeploy(job.projectId, { skipLock: true });
  }

  if (job.step === 'VAULT_DEPLOY') {
    const { executeProjectVaultDeploy } = await import('../blockchain/projectTokenDeploy');
    return executeProjectVaultDeploy(job.projectId, { skipLock: true });
  }

  if (job.step === 'COLLATERAL_REGISTER') {
    const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
    return registerProjectCollateral(job.projectId, undefined, { skipLock: true });
  }

  if (job.step === 'MORPHO_LIQUIDITY') {
    const asset = await getAdminAsset(job.projectId);
    if (!asset) throw new Error('Asset not found');
    const { checkMorphoLiquidity } = await import('../lending/morphoLiquidityCheck');
    return checkMorphoLiquidity(asset);
  }

  if (job.step === 'EXPLORER_VERIFY') {
    const asset = await getAdminAsset(job.projectId);
    if (!asset) throw new Error('Asset not found');
    const { recordExplorerVerification } = await import('../blockchain/contractVerification');
    const results = [];
    if (asset.contractAddress && asset.chainId) {
      results.push(await recordExplorerVerification(job.projectId, {
        contractAddress: asset.contractAddress,
        contractName: 'SanovaAssetToken',
        chainId: asset.chainId
      }));
    }
    if (asset.vaultAddress && asset.chainId) {
      results.push(await recordExplorerVerification(job.projectId, {
        contractAddress: asset.vaultAddress,
        contractName: 'SanovaRwaVault',
        chainId: asset.chainId
      }));
    }
    return results;
  }

  throw new Error(`Unsupported automation job: ${job.step}`);
}

export async function processAutomationJobs(limit = 5) {
  const delegate = jobDelegate();
  if (!delegate) {
    return { processed: 0, jobs: [], tableAvailable: false };
  }

  const jobs = await delegate.findMany({
    where: {
      status: { in: ['QUEUED', 'RETRY'] },
      runAfter: { lte: new Date() }
    },
    orderBy: [{ runAfter: 'asc' }, { createdAt: 'asc' }],
    take: limit
  });

  const results = [];
  for (const job of jobs) {
    await delegate.update({
      where: { id: job.id },
      data: {
        status: 'RUNNING',
        lockedAt: new Date(),
        lockedBy: process.env.VERCEL_REGION ?? 'local'
      }
    });

    try {
      const result = await executeAutomationJob(job);
      await delegate.update({
        where: { id: job.id },
        data: {
          status: 'DONE',
          result: JSON.parse(JSON.stringify(result ?? {})),
          error: null,
          lockedAt: null,
          lockedBy: null
        }
      });
      if (job.projectId) {
        await appendDeploymentEvent(job.projectId, {
          step: jobStepToEventStep(job.step),
          status: 'SUCCESS',
          message: `Job ${job.step} completado.`,
          externalId: job.id
        }).catch(() => undefined);
      }
      results.push({ id: job.id, step: job.step, status: 'DONE' });
    } catch (error) {
      const attempts = job.attempts + 1;
      const failed = attempts >= job.maxAttempts;
      const message = error instanceof Error ? error.message : 'Automation job failed';
      await delegate.update({
        where: { id: job.id },
        data: {
          status: failed ? 'FAILED' : 'RETRY',
          attempts,
          error: message,
          runAfter: failed ? new Date() : retryAt(attempts),
          lockedAt: null,
          lockedBy: null
        }
      });
      if (job.projectId) {
        await appendDeploymentEvent(job.projectId, {
          step: jobStepToEventStep(job.step),
          status: failed ? 'FAILED' : 'PENDING',
          message,
          externalId: job.id
        }).catch(() => undefined);
      }
      results.push({ id: job.id, step: job.step, status: failed ? 'FAILED' : 'RETRY', error: message });
    }
  }

  return { processed: results.length, jobs: results, tableAvailable: true };
}
