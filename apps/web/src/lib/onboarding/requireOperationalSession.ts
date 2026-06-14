import { prisma } from '@sanova/database';
import { assertInvestorAccessEnabled } from '../auth/investorAccess';
import { isMarketplaceTradingRole, type SystemRole } from '../auth/roles';
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
      systemRole: true,
      investorAccessEnabled: true
    }
  });

  if (!user || !isAccountOperational(user)) {
    return { kycRequired: true as const, userId: ctx.userId, session: ctx.session };
  }

  return { ...ctx, user };
}

/** Operational session restricted to INVESTOR role (marketplace purchases, secondary market). */
export async function requireInvestorOperationalSession() {
  const ctx = await requireOperationalSession();

  if (!ctx) {
    return null;
  }

  if ('kycRequired' in ctx) {
    return ctx;
  }

  if (!isMarketplaceTradingRole(ctx.user.systemRole as SystemRole)) {
    return { investorRequired: true as const, userId: ctx.userId, session: ctx.session };
  }

  try {
    assertInvestorAccessEnabled(ctx.user);
  } catch {
    return { investorAccessDisabled: true as const, userId: ctx.userId, session: ctx.session };
  }

  return ctx;
}
