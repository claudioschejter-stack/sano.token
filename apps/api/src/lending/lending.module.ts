import { Module } from '@nestjs/common';
import { LendingAggregatorService } from './lending-aggregator.service';
import { LendingController } from './lending.controller';
import { AaveRateProvider } from './protocols/aave-rate.provider';
import { CompoundRateProvider } from './protocols/compound-rate.provider';
import { MakerRateProvider } from './protocols/maker-rate.provider';

@Module({
  controllers: [LendingController],
  providers: [
    LendingAggregatorService,
    AaveRateProvider,
    CompoundRateProvider,
    MakerRateProvider
  ],
  exports: [LendingAggregatorService]
})
export class LendingModule {}
