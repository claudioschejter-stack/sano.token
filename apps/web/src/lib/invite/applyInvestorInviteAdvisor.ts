import { prisma } from '@sanova/database';
import { normalizeEmail } from '../auth/contactValidation';

/** Apply incorporated-by-advisor from accepted investor TeamInvite. */
export async function applyInvestorInviteAdvisorForUser(userId: string, email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return;
  }

  const invite = await prisma.teamInvite.findFirst({
    where: {
      email: normalized,
      role: 'INVESTOR',
      status: { in: ['PENDING', 'ACCEPTED'] },
      uplineAdvisorId: { not: null }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!invite?.uplineAdvisorId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { investorId: true, systemRole: true }
  });

  if (!user || user.systemRole !== 'INVESTOR' || !user.investorId) {
    return;
  }

  const investor = await prisma.investor.findUnique({
    where: { id: user.investorId },
    select: { incorporatedByAdvisorId: true }
  });

  if (investor?.incorporatedByAdvisorId) {
    return;
  }

  await prisma.investor.update({
    where: { id: user.investorId },
    data: { incorporatedByAdvisorId: invite.uplineAdvisorId }
  });
}
