import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KycWebhookController } from './kyc-webhook.controller';
import { KycWebhookService } from './kyc-webhook.service';

@Module({
  imports: [PrismaModule],
  controllers: [KycWebhookController],
  providers: [KycWebhookService]
})
export class KycModule {}
