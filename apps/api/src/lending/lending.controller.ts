import { Controller, Get } from '@nestjs/common';
import { LendingAggregatorService } from './lending-aggregator.service';

@Controller('lending')
export class LendingController {
  constructor(private readonly lendingAggregator: LendingAggregatorService) {}

  @Get('best-borrow-rate')
  getBestBorrowRate() {
    return this.lendingAggregator.getBestBorrowRate();
  }
}
