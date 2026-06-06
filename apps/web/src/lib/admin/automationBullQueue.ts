import { logAutomationEvent } from './automationLogger';
import type { AutomationJobStep } from './automationJobs';

type QueueJobPayload = {
  projectId?: string | null;
  step: AutomationJobStep;
  automationJobId?: string;
};

let queuePromise: Promise<import('bullmq').Queue<QueueJobPayload> | null> | null = null;

function bullEnabled(): boolean {
  return process.env.BULL_ENABLED === 'true' && Boolean(process.env.REDIS_URL?.trim());
}

async function getQueue(): Promise<import('bullmq').Queue<QueueJobPayload> | null> {
  if (!bullEnabled()) return null;
  if (!queuePromise) {
    queuePromise = (async () => {
      try {
        const { Queue } = await import('bullmq');
        const { default: IORedis } = await import('ioredis');
        const connection = new IORedis(process.env.REDIS_URL!.trim(), {
          maxRetriesPerRequest: null
        });
        return new Queue<QueueJobPayload>('sanova-automation', { connection });
      } catch (error) {
        console.warn('[automationBullQueue] BullMQ unavailable:', error);
        return null;
      }
    })();
  }
  return queuePromise;
}

/** Mirror AutomationJob enqueue to BullMQ for durable workers (optional). */
export async function mirrorAutomationJobToBull(input: QueueJobPayload): Promise<void> {
  const queue = await getQueue();
  if (!queue) return;

  try {
    await queue.add(input.step, input, {
      removeOnComplete: 100,
      removeOnFail: 200,
      jobId: input.automationJobId
    });
    logAutomationEvent({
      event: 'job.bull_mirror',
      projectId: input.projectId,
      step: input.step,
      status: 'QUEUED',
      metadata: { automationJobId: input.automationJobId ?? null }
    });
  } catch (error) {
    console.warn('[automationBullQueue] mirror failed:', error);
  }
}
