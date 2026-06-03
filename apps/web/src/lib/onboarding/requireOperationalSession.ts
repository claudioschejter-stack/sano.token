import { prisma } from '@sanova/database';
import { isAccountOperational } from './accountStatus';
import { requireAuthenticatedSession } from './requireAuthenticatedSession';

export async function requireOperationalSession() {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      walletAddress: true,
      investorId: true,
      kycStatus: true,
      accountStatus: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      systemRole: true
    }
  });

  if (!user || !isAccountOperational(user)) {
    return { kycRequired: true as const, userId: ctx.userId, session: ctx.session };
  }

  return { ...ctx, user };
}
