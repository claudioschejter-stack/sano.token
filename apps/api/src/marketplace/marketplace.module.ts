import { Module } from '@nestjs/common';
import { LendingModule } from '../lending/lending.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceFeedCacheService } from './marketplace-feed-cache.service';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [PrismaModule, LendingModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, MarketplaceFeedCacheService],
  exports: [MarketplaceService]
})
export class MarketplaceModule {}
