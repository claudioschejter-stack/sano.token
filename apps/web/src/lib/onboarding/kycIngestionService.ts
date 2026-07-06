import type { KycStatus, Prisma } from '@prisma/client';
import { prisma } from '@sanova/database';
import { autoAllowlistInvestorWallet } from '../blockchain/autoAllowlistInvestorWallet';
import { provisionInvestorProfileOnKycApproval } from '../investor/provisionInvestorProfile';
import { buildDiditIdentityUpdate, extractDiditIdentity } from './extractDiditIdentity';
import { retrieveDiditDecision } from './diditService';
import { persistDiditMedia } from './diditMedia';
import { isContactVerificationComplete } from './contactVerification';
import { syncUserAccountStatus } from './syncUserAccount';

type DiditPayload = Record<string, unknown>;

function asJsonPayload(payload: DiditPayload): Prisma.InputJsonValue {
  return payload as Prisma.InputJsonValue;
}

function resolveSessionId(sessionId: string | null | undefined): string {
  const trimmed = sessionId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'unknown';
}

async function upsertDiditVerification(input: {
  userId: string;
  sessionId: string;
  kycStatus: KycStatus;
  webhookPayload: DiditPayload;
  decisionPayload?: DiditPayload | null;
  pendingContact: boolean;
}) {
  const now = new Date();

  return prisma.kycVerification.upsert({
    where: {
      userId_sessionId: {
        userId: input.userId,
        sessionId: input.sessionId
      }
    },
    create: {
      userId: input.userId,
      provider: 'DIDIT',
      sessionId: input.sessionId,
      status: input.kycStatus,
      pendingContact: input.pendingContact,
      rawWebhookPayload: asJsonPayload(input.webhookPayload),
      rawDecisionPayload: input.decisionPayload ? asJsonPayload(input.decisionPayload) : undefined,
      approvedAt: input.kycStatus === 'APPROVED' ? now : undefined,
      rejectedAt: input.kycStatus === 'REJECTED' ? now : undefined
    },
    update: {
      status: input.kycStatus,
      pendingContact: input.pendingContact,
      rawWebhookPayload: asJsonPayload(input.webhookPayload),
      ...(input.decisionPayload ? { rawDecisionPayload: asJsonPayload(input.decisionPayload) } : {}),
      ...(input.kycStatus === 'APPROVED' ? { approvedAt: now, rejectedAt: null } : {}),
      ...(input.kycStatus === 'REJECTED' ? { rejectedAt: now } : {})
    }
  });
}

async function notifyKycApproved(userId: string): Promise<void> {
  const { notifyAdvisorOfClientKycApproved } = await import('../advisor/advisorNotificationService');
  void notifyAdvisorOfClientKycApproved(userId);

  const { notifyInvestorOfKycApproved } = await import('../investor/investorNotificationService');
  void notifyInvestorOfKycApproved(userId);

  const { createNotification } = await import('../notifications/notificationService');
  void createNotification({
    userId,
    type: 'kyc_approved',
    title: '¡Tu cuenta fue aprobada!',
    body: 'Ya podés invertir en el marketplace de Sanova Capital.',
    link: '/dashboard'
  });
}

export async function finalizeApprovedKyc(input: {
  userId: string;
  kycVerificationId: string;
  payload: DiditPayload;
}): Promise<void> {
  await persistDiditMedia({
    userId: input.userId,
    kycVerificationId: input.kycVerificationId,
    payload: input.payload
  });
  await provisionInvestorProfileOnKycApproval(input.userId);
  await notifyKycApproved(input.userId);
  void autoAllowlistInvestorWallet(input.userId);
}

export async function applyDiditToUser(input: {
  userId: string;
  kycStatus: KycStatus;
  payload: DiditPayload;
  sessionId: string;
  kycVerificationId: string;
}): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { kycStatus: true }
  });
  const wasApproved = existingUser?.kycStatus === 'APPROVED';

  const identity = extractDiditIdentity(input.payload);

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      kycStatus: input.kycStatus,
      kycProviderId: input.sessionId !== 'unknown' ? input.sessionId : undefined,
      diditSessionId: input.sessionId !== 'unknown' ? input.sessionId : undefined,
      ...buildDiditIdentityUpdate(identity)
    }
  });

  await syncUserAccountStatus(input.userId);

  if (input.kycStatus === 'APPROVED' && !wasApproved) {
    await finalizeApprovedKyc({
      userId: input.userId,
      kycVerificationId: input.kycVerificationId,
      payload: input.payload
    });
  } else if (input.kycStatus === 'APPROVED' && wasApproved) {
    await persistDiditMedia({
      userId: input.userId,
      kycVerificationId: input.kycVerificationId,
      payload: input.payload
    });
  }
}

export async function ingestDiditWebhook(input: {
  userId: string;
  sessionId: string | null | undefined;
  kycStatus: KycStatus;
  payload: DiditPayload;
}): Promise<{ ok: true; pendingContact?: boolean; skipped?: string }> {
  const sessionId = resolveSessionId(input.sessionId);
  const existingUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      phone: true,
      systemRole: true
    }
  });

  if (!existingUser) {
    return { ok: true, skipped: 'user_not_found' };
  }

  const contactComplete = isContactVerificationComplete(existingUser);
  const verification = await upsertDiditVerification({
    userId: input.userId,
    sessionId,
    kycStatus: input.kycStatus,
    webhookPayload: input.payload,
    pendingContact: !contactComplete
  });

  if (!contactComplete) {
    return { ok: true, pendingContact: true };
  }

  await prisma.kycVerification.update({
    where: { id: verification.id },
    data: { pendingContact: false }
  });

  await applyDiditToUser({
    userId: input.userId,
    kycStatus: input.kycStatus,
    payload: input.payload,
    sessionId,
    kycVerificationId: verification.id
  });

  return { ok: true };
}

export async function ingestDiditDecision(input: {
  userId: string;
  sessionId: string;
  kycStatus: KycStatus;
  decisionPayload: DiditPayload;
}): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      phone: true,
      systemRole: true
    }
  });

  if (!existingUser) {
    return;
  }

  const contactComplete = isContactVerificationComplete(existingUser);
  const verification = await upsertDiditVerification({
    userId: input.userId,
    sessionId: input.sessionId,
    kycStatus: input.kycStatus,
    webhookPayload: input.decisionPayload,
    decisionPayload: input.decisionPayload,
    pendingContact: !contactComplete
  });

  if (!contactComplete) {
    return;
  }

  await prisma.kycVerification.update({
    where: { id: verification.id },
    data: { pendingContact: false }
  });

  await applyDiditToUser({
    userId: input.userId,
    kycStatus: input.kycStatus,
    payload: input.decisionPayload,
    sessionId: input.sessionId,
    kycVerificationId: verification.id
  });
}

export async function reprocessPendingKycForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      phone: true,
      systemRole: true
    }
  });

  if (!user || !isContactVerificationComplete(user)) {
    return;
  }

  const pendingRows = await prisma.kycVerification.findMany({
    where: { userId, pendingContact: true },
    orderBy: { updatedAt: 'desc' }
  });

  if (pendingRows.length === 0) {
    return;
  }

  const approvedRows = pendingRows.filter((row) => row.status === 'APPROVED');
  const target = approvedRows[0] ?? pendingRows[0];

  await prisma.kycVerification.updateMany({
    where: {
      userId,
      pendingContact: true,
      id: { not: target.id }
    },
    data: { pendingContact: false }
  });

  let payload =
    (target.rawDecisionPayload as DiditPayload | null) ??
    (target.rawWebhookPayload as DiditPayload | null);

  if ((!payload || Object.keys(payload).length === 0) && target.sessionId !== 'unknown') {
    try {
      payload = await retrieveDiditDecision(target.sessionId);
      await prisma.kycVerification.update({
        where: { id: target.id },
        data: { rawDecisionPayload: asJsonPayload(payload) }
      });
    } catch (error) {
      console.warn(
        '[kycIngestion] decision fetch failed',
        target.sessionId,
        error instanceof Error ? error.message : error
      );
      return;
    }
  }

  if (!payload) {
    return;
  }

  await prisma.kycVerification.update({
    where: { id: target.id },
    data: { pendingContact: false }
  });

  await applyDiditToUser({
    userId,
    kycStatus: target.status,
    payload,
    sessionId: target.sessionId,
    kycVerificationId: target.id
  });
}

export async function maybeReprocessPendingKyc(userId: string): Promise<void> {
  await reprocessPendingKycForUser(userId);
}
