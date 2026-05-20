import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

export type HealthCheckResult = {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  timestamp: string;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down' | 'skipped';
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async getHealth(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {
      database: 'down',
      redis: 'skipped'
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    const bullEnabled = this.config.get<string>('BULL_ENABLED') !== 'false';
    if (bullEnabled) {
      const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
        lazyConnect: true
      });

      try {
        await redis.connect();
        const pong = await redis.ping();
        checks.redis = pong === 'PONG' ? 'up' : 'down';
      } catch {
        checks.redis = 'down';
      } finally {
        redis.disconnect();
      }
    }

    let status: HealthCheckResult['status'] = 'ok';
    if (checks.database === 'down') {
      status = 'down';
    } else if (checks.redis === 'down') {
      status = 'degraded';
    }

    return {
      status,
      service: '@sanova/api',
      timestamp: new Date().toISOString(),
      checks
    };
  }
}
