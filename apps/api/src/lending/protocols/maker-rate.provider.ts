import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BorrowRateQuote } from '../lending.types';

@Injectable()
export class MakerRateProvider {
  private readonly logger = new Logger(MakerRateProvider.name);

  constructor(private readonly config: ConfigService) {}

  async fetchBorrowApy(): Promise<BorrowRateQuote> {
    const configuredBps = Number(this.config.get<string>('MAKER_BORROW_APY_BPS') ?? '460');

    this.logger.debug(`Maker borrow APY (configured/mock): ${configuredBps} bps`);

    return {
      protocol: 'maker',
      borrowApyBps: configuredBps,
      source: 'maker-dss-stability-fee',
      fetchedAt: new Date().toISOString()
    };
  }
}
