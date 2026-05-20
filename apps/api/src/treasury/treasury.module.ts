import { Module } from '@nestjs/common';
import { BlockchainWriterModule } from '../blockchain/blockchain-writer.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DividendDistributionService } from './dividend-distribution.service';
import { TreasuryManagerService } from './treasury-manager.service';

@Module({
  imports: [PrismaModule, BlockchainWriterModule],
  providers: [TreasuryManagerService, DividendDistributionService],
  exports: [TreasuryManagerService, DividendDistributionService]
})
export class TreasuryModule {}
