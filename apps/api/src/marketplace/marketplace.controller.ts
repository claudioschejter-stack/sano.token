import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('listings')
  listListings() {
    return this.marketplaceService.listActiveListings();
  }

  @Get('feed')
  getFeed() {
    return this.marketplaceService.getFeed();
  }
}
