import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { TreasuryManagerService } from '../treasury/treasury-manager.service';

type SettlementPayload = {
  projectId: string;
  amountUsd: string;
  executionMode?: 'SIMULATED' | 'ONCHAIN';
};

@Processor('settlements')
export class SettlementProcessor extends WorkerHost {
  constructor(private readonly treasuryManager: TreasuryManagerService) {
    super();
  }

  async process(job: Job<SettlementPayload>) {
    const { projectId, amountUsd } = job.data;
    const totalYieldAmount = Number(amountUsd);

    return this.treasuryManager.processDividendPayout(projectId, totalYieldAmount);
  }
}
