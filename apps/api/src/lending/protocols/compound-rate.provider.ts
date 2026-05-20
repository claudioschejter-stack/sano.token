import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BorrowRateQuote } from '../lending.types';

@Injectable()
export class CompoundRateProvider {
  private readonly logger = new Logger(CompoundRateProvider.name);

  constructor(private readonly config: ConfigService) {}

  async fetchBorrowApy(): Promise<BorrowRateQuote> {
    const configuredBps = Number(this.config.get<string>('COMPOUND_BORROW_APY_BPS') ?? '512');

    this.logger.debug(`Compound borrow APY (configured/mock): ${configuredBps} bps`);

    return {
      protocol: 'compound',
      borrowApyBps: configuredBps,
      source: 'compound-v3-comet',
      fetchedAt: new Date().toISOString()
    };
  }
}
