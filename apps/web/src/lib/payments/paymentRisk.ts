import { prisma } from '@sanova/database';

export async function scorePaymentRisk(input: {
  userId: string;
  projectId: string;
  amountUsd: number;
  walletAddress?: string | null;
  method: string;
}) {
  const reasons: string[] = [];
  let score = 0;
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { createdAt: true, walletAddress: true, kycProviderId: true }
  });

  if (user && Date.now() - user.createdAt.getTime() < 24 * 60 * 60 * 1000) {
    score += 20;
    reasons.push('NEW_USER');
  }

  if (!user?.kycProviderId) {
    score += 10;
    reasons.push('KYC_PROVIDER_MISSING');
  }

  if (input.walletAddress && user?.walletAddress && input.walletAddress.toLowerCase() !== user.walletAddress.toLowerCase()) {
    score += 20;
    reasons.push('WALLET_CHANGED');
  }

  if (input.amountUsd >= Number(process.env.PAYMENT_HIGH_RISK_AMOUNT_USD ?? 10000)) {
    score += 20;
    reasons.push('HIGH_AMOUNT');
  }

  if (input.method !== 'USDC_ONCHAIN') {
    score += 10;
    reasons.push('GATEWAY_PAYMENT');
  }

  const failed = await prisma.paymentIntent.count({
    where: {
      userId: input.userId,
      projectId: input.projectId,
      status: { in: ['FAILED', 'MANUAL_REVIEW'] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  });
  if (failed >= 3) {
    score += 25;
    reasons.push('MULTIPLE_FAILED_ATTEMPTS');
  }

  const threshold = Number(process.env.PAYMENT_MANUAL_REVIEW_RISK_SCORE ?? 60);
  return { score, reasons, requiresManualReview: score >= threshold };
}
