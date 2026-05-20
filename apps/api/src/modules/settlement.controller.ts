import { Body, Controller, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

type SettlementRequest = {
  projectId: string;
  amountUsd: string;
  executionMode?: 'SIMULATED' | 'ONCHAIN';
};

@Controller('settlements')
export class SettlementController {
  constructor(@InjectQueue('settlements') private readonly settlementsQueue: Queue) {}

  @Post()
  async enqueueSettlement(@Body() body: SettlementRequest) {
    const job = await this.settlementsQueue.add('distribute-dividends', body, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 1000
    });

    return {
      jobId: job.id,
      status: 'queued'
    };
  }
}
