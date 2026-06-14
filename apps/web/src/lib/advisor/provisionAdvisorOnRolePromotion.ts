import { prisma } from '@sanova/database';
import { normalizeEmail } from '../auth/contactValidation';
import type { SystemRole } from '../auth/roles';

/** Ensures Advisor row exists after staff role promotion (allowlist login, team invite, etc.). */
export async function provisionAdvisorRecordOnRolePromotion(
  userId: string,
  email: string,
  role: SystemRole
): Promise<void> {
  if (role === 'ADVISOR_MANAGER') {
    await prisma.advisor.upsert({
      where: { userId },
      create: { userId, uplineId: null },
      update: {}
    });
    return;
  }

  if (role !== 'ADVISOR') {
    return;
  }

  const existing = await prisma.advisor.findUnique({
    where: { userId },
    select: { id: true }
  });

  if (existing) {
    return;
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    return;
  }

  const invite = await prisma.teamInvite.findFirst({
    where: {
      email: normalized,
      role: { in: ['ADVISOR', 'ADVISOR_MANAGER'] },
      status: { in: ['PENDING', 'ACCEPTED'] }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (invite?.role === 'ADVISOR_MANAGER') {
    await prisma.advisor.upsert({
      where: { userId },
      create: { userId, uplineId: null },
      update: {}
    });
    return;
  }

  if (!invite?.uplineAdvisorId) {
    return;
  }

  await prisma.advisor.upsert({
    where: { userId },
    create: { userId, uplineId: invite.uplineAdvisorId },
    update: { uplineId: invite.uplineAdvisorId }
  });
}
