import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BorrowRateQuote } from '../lending.types';

@Injectable()
export class AaveRateProvider {
  private readonly logger = new Logger(AaveRateProvider.name);

  constructor(private readonly config: ConfigService) {}

  async fetchBorrowApy(): Promise<BorrowRateQuote> {
    const configuredBps = Number(this.config.get<string>('AAVE_BORROW_APY_BPS') ?? '485');

    this.logger.debug(`Aave borrow APY (configured/mock): ${configuredBps} bps`);

    return {
      protocol: 'aave',
      borrowApyBps: configuredBps,
      source: 'aave-v3-pool',
      fetchedAt: new Date().toISOString()
    };
  }
}
