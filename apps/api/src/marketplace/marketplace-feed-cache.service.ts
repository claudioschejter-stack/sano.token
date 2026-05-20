import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { MarketplaceFeedDto } from './marketplace.types';

const CACHE_KEY = 'sanova:marketplace:feed';
const DEFAULT_TTL_SECONDS = 30;

@Injectable()
export class MarketplaceFeedCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(MarketplaceFeedCacheService.name);
  private readonly ttlSeconds: number;
  private memoryEntry: { payload: MarketplaceFeedDto; expiresAt: number } | null = null;
  private redis: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    this.ttlSeconds = Number(this.config.get<string>('MARKETPLACE_FEED_CACHE_TTL') ?? DEFAULT_TTL_SECONDS);
    const redisUrl = this.config.get<string>('REDIS_URL');
    const useRedis = this.config.get<string>('MARKETPLACE_CACHE_REDIS') === 'true';

    if (useRedis && redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false
      });
      void this.redis.connect().catch((error) => {
        this.logger.warn(`Redis feed cache disabled: ${error}`);
        this.redis?.disconnect();
        this.redis = null;
      });
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async getOrSet(factory: () => Promise<MarketplaceFeedDto>): Promise<MarketplaceFeedDto> {
    const cached = await this.read();
    if (cached) {
      return cached;
    }

    const fresh = await factory();
    await this.write(fresh);
    return fresh;
  }

  private async read(): Promise<MarketplaceFeedDto | null> {
    const now = Date.now();

    if (this.memoryEntry && this.memoryEntry.expiresAt > now) {
      return this.memoryEntry.payload;
    }

    if (!this.redis) {
      return null;
    }

    try {
      const raw = await this.redis.get(CACHE_KEY);
      if (!raw) {
        return null;
      }

      const payload = JSON.parse(raw) as MarketplaceFeedDto;
      this.memoryEntry = {
        payload,
        expiresAt: now + this.ttlSeconds * 1000
      };
      return payload;
    } catch (error) {
      this.logger.warn(`Redis cache read failed: ${error}`);
      return null;
    }
  }

  private async write(payload: MarketplaceFeedDto) {
    const expiresAt = Date.now() + this.ttlSeconds * 1000;
    this.memoryEntry = { payload, expiresAt };

    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', this.ttlSeconds);
    } catch (error) {
      this.logger.warn(`Redis cache write failed: ${error}`);
    }
  }
}
