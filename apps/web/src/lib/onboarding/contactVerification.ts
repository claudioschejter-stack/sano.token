import { prisma } from '@sanova/database';
import { requireInvestorSession } from './requireInvestorSession';

export type ContactVerificationFields = {
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  phone: string | null;
};

export function isContactVerificationComplete(user: ContactVerificationFields): boolean {
  return (
    Boolean(user.phone) &&
    Boolean(user.emailVerifiedAt) &&
    Boolean(user.phoneVerifiedAt)
  );
}

export async function requireContactVerifiedInvestor() {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return null;
  }

  if ('forbidden' in ctx) {
    return ctx;
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      phone: true
    }
  });

  if (!user || !isContactVerificationComplete(user)) {
    return { contactRequired: true as const, userId: ctx.userId, email: ctx.email, session: ctx.session };
  }

  return { ...ctx, contact: user };
}
