import { prisma } from '@sanova/database';
import { applyDiditToUser } from './kycIngestionService';

const DEFAULT_DEMO_PORTRAIT_PATH = 'kyc-documents/demo/placeholder.jpg';

function resolveDemoPortraitPath(): string {
  const configured = process.env.DEMO_KYC_PORTRAIT_PATH?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_DEMO_PORTRAIT_PATH;
}

export async function approveDemoKycForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, kycFullName: true }
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const sessionId = `demo-${userId}`;
  const payload = {
    source: 'demo',
    decision: {
      id_verifications: [
        {
          full_name: user.kycFullName?.trim() || user.name?.trim() || user.email.split('@')[0],
          document_number: 'DEMO'
        }
      ]
    }
  };

  const verification = await prisma.kycVerification.upsert({
    where: {
      userId_sessionId: {
        userId,
        sessionId
      }
    },
    create: {
      userId,
      provider: 'DIDIT',
      sessionId,
      status: 'APPROVED',
      pendingContact: false,
      rawWebhookPayload: payload,
      rawDecisionPayload: payload,
      approvedAt: new Date()
    },
    update: {
      status: 'APPROVED',
      pendingContact: false,
      rawWebhookPayload: payload,
      rawDecisionPayload: payload,
      approvedAt: new Date(),
      rejectedAt: null
    }
  });

  await applyDiditToUser({
    userId,
    kycStatus: 'APPROVED',
    payload,
    sessionId,
    kycVerificationId: verification.id
  });

  const portraitPath = resolveDemoPortraitPath();
  await prisma.user.update({
    where: { id: userId },
    data: { kycPortraitPath: portraitPath }
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { investorId: true }
  });

  if (updatedUser?.investorId) {
    await prisma.investor.update({
      where: { id: updatedUser.investorId },
      data: { portraitPath }
    });
  }
}
