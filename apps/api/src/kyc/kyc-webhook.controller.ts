import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { SumsubWebhookPayload } from './dto/sumsub-webhook.dto';
import { KycWebhookService } from './kyc-webhook.service';

@Controller('webhooks/kyc')
export class KycWebhookController {
  constructor(private readonly kycWebhook: KycWebhookService) {}

  @Post('sumsub')
  handleSumsub(
    @Req() request: Request & { rawBody?: Buffer },
    @Body() payload: SumsubWebhookPayload,
    @Headers('x-payload-digest') signature?: string
  ) {
    const rawBody =
      request.rawBody?.toString('utf8') ??
      (typeof request.body === 'string' ? request.body : JSON.stringify(payload));

    this.kycWebhook.verifySumsubSignature(rawBody, signature);
    return this.kycWebhook.handleSumsubApproval(payload);
  }
}
