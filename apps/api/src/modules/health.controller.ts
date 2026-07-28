import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { HealthService } from './health.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness probe — process is up (Railway / k8s). Does not check DB or Redis. */
  @Get('live')
  getLive() {
    return {
      status: 'ok',
      service: '@sanova/api',
      timestamp: new Date().toISOString()
    };
  }

  @Get()
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const payload = await this.healthService.getHealth();

    if (payload.status === 'down') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    } else if (payload.status === 'degraded') {
      response.status(HttpStatus.OK);
    }

    return payload;
  }
}
