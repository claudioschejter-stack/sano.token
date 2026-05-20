import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventsModule } from './events/events.module';
import { KycModule } from './kyc/kyc.module';
import { LendingModule } from './lending/lending.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { InvestorModule } from './investor/investor.module';
import { PrismaModule } from './prisma/prisma.module';
import { TreasuryModule } from './treasury/treasury.module';
import { HealthModule } from './modules/health.module';
import { SettlementController } from './modules/settlement.controller';
import { SettlementProcessor } from './modules/settlement.processor';

const bullQueueEnabled = process.env.BULL_ENABLED !== 'false';

const bullImports = bullQueueEnabled
  ? [
      BullModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          connection: {
            url: configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379'
          }
        })
      }),
      BullModule.registerQueue({
        name: 'settlements'
      })
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '..', '..', '.env.local'),
        join(__dirname, '..', '..', '..', '.env')
      ]
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100
      }
    ]),
    ...bullImports,
    PrismaModule,
    TreasuryModule,
    BlockchainModule,
    InvestorModule,
    AuthModule,
    EventsModule,
    LendingModule,
    KycModule,
    MarketplaceModule,
    HealthModule
  ],
  controllers: bullQueueEnabled ? [SettlementController] : [],
  providers: bullQueueEnabled ? [SettlementProcessor] : []
})
export class AppModule {}
