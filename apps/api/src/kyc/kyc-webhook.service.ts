import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KycStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { SumsubWebhookPayload } from './dto/sumsub-webhook.dto';

@Injectable()
export class KycWebhookService {
  private readonly logger = new Logger(KycWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  verifySumsubSignature(rawBody: string, signatureHeader?: string) {
    const secret = this.config.get<string>('SUMSUB_WEBHOOK_SECRET')?.trim();
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';

    if (!secret) {
      if (nodeEnv === 'production') {
        throw new BadRequestException('SUMSUB_WEBHOOK_SECRET is required in production.');
      }
      return true;
    }

    if (!signatureHeader) {
      throw new BadRequestException('Missing Sumsub signature header.');
    }

    const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/i, '');

    const expectedBuffer = Buffer.from(digest, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new BadRequestException('Invalid Sumsub webhook signature.');
    }

    return true;
  }

  async handleSumsubApproval(payload: SumsubWebhookPayload) {
    const reviewAnswer = payload.reviewResult?.reviewAnswer?.toUpperCase();
    const isApproved =
      payload.reviewStatus?.toUpperCase() === 'COMPLETED' && reviewAnswer === 'GREEN';

    if (!isApproved) {
      return {
        status: 'IGNORED',
        reason: 'Webhook is not an approval event.'
      };
    }

    const providerId = payload.applicantId;
    const externalUserId = payload.externalUserId;

    if (!providerId && !externalUserId) {
      throw new BadRequestException('Sumsub payload missing applicant identifiers.');
    }

    const orConditions = [
      ...(providerId ? [{ kycProviderId: providerId }] : []),
      ...(externalUserId
        ? [{ id: externalUserId }, { walletAddress: externalUserId }]
        : [])
    ];

    if (orConditions.length === 0) {
      throw new BadRequestException('Sumsub payload missing applicant identifiers.');
    }

    const user = await this.prisma.user.findFirst({
      where: { OR: orConditions },
      include: { investor: true }
    });

    if (!user) {
      throw new NotFoundException('User not found for Sumsub webhook identifiers.');
    }

    const verifiedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          kycStatus: KycStatus.APPROVED,
          kycProviderId: providerId ?? user.kycProviderId
        }
      });

      if (user.investorId) {
        await tx.investor.update({
          where: { id: user.investorId },
          data: {
            kycStatus: KycStatus.APPROVED,
            kycVerifiedAt: verifiedAt
          }
        });
      }
    });

    this.logger.log(`KYC auto-verified for user ${user.id} via Sumsub.`);

    return {
      status: 'VERIFIED',
      userId: user.id,
      investorId: user.investorId,
      kycProviderId: providerId ?? user.kycProviderId,
      verifiedAt: verifiedAt.toISOString()
    };
  }
}
