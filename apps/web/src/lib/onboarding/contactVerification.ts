import { prisma } from '@sanova/database';
import { requireAuthenticatedSession } from './requireAuthenticatedSession';
import { isContactStepComplete } from './phoneVerificationPolicy';

export type ContactVerificationFields = {
  emailVerifiedAt: Date | null;
  phone: string | null;
  phoneVerifiedAt?: Date | null;
  systemRole?: string | null;
};

export function isContactVerificationComplete(user: ContactVerificationFields): boolean {
  return isContactStepComplete(user);
}

export async function requireContactVerifiedUser() {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      emailVerifiedAt: true,
      phone: true,
      phoneVerifiedAt: true,
      systemRole: true
    }
  });

  if (!user || !isContactVerificationComplete(user)) {
    return { contactRequired: true as const, userId: ctx.userId, email: ctx.email, session: ctx.session };
  }

  return { ...ctx, contact: user };
}
