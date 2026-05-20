import { Injectable, Logger } from '@nestjs/common';
import type { BestBorrowRateResult, BorrowRateQuote } from './lending.types';
import { AaveRateProvider } from './protocols/aave-rate.provider';
import { CompoundRateProvider } from './protocols/compound-rate.provider';
import { MakerRateProvider } from './protocols/maker-rate.provider';

@Injectable()
export class LendingAggregatorService {
  private readonly logger = new Logger(LendingAggregatorService.name);

  constructor(
    private readonly aave: AaveRateProvider,
    private readonly compound: CompoundRateProvider,
    private readonly maker: MakerRateProvider
  ) {}

  /**
   * Consulta en paralelo las tasas Borrow APY y devuelve la opción más competitiva (menor APY).
   */
  async getBestBorrowRate(): Promise<BestBorrowRateResult> {
    const settled = await Promise.allSettled([
      this.aave.fetchBorrowApy(),
      this.compound.fetchBorrowApy(),
      this.maker.fetchBorrowApy()
    ]);

    const quotes: BorrowRateQuote[] = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        quotes.push(result.value);
        continue;
      }

      this.logger.warn(`Lending protocol quote failed: ${result.reason}`);
    }

    if (quotes.length === 0) {
      throw new Error('No lending protocol quotes available.');
    }

    const best = quotes.reduce((current, candidate) =>
      candidate.borrowApyBps < current.borrowApyBps ? candidate : current
    );

    return { best, quotes };
  }
}
