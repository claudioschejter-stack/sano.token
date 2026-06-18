import { prisma } from '@sanova/database';
import { normalizeEmail } from '../auth/contactValidation';
import { extractVerifiedPrivyEmails, fetchPrivyUser } from '../privy/privyUserApi';
import { verifyPrivyAccessToken } from '../privy/verifyAccessToken';
import { syncUserAccountStatus } from './syncUserAccount';

export type SyncPrivyEmailResult = {
  synced: boolean;
  emailVerifiedAt: Date | null;
  reason?: 'ALREADY_VERIFIED' | 'EMAIL_MISMATCH' | 'PRIVY_EMAIL_NOT_VERIFIED';
};

export async function syncPrivyEmailVerification(
  userId: string,
  privyAccessToken: string
): Promise<SyncPrivyEmailResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true }
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (user.emailVerifiedAt) {
    return {
      synced: false,
      emailVerifiedAt: user.emailVerifiedAt,
      reason: 'ALREADY_VERIFIED'
    };
  }

  const accountEmail = normalizeEmail(user.email);
  if (!accountEmail) {
    throw new Error('INVALID_EMAIL');
  }

  const verifiedClaims = await verifyPrivyAccessToken(privyAccessToken);
  const privyUser = await fetchPrivyUser(verifiedClaims.userId);
  const verifiedEmails = extractVerifiedPrivyEmails(privyUser.linked_accounts ?? []);

  if (!verifiedEmails.includes(accountEmail)) {
    return {
      synced: false,
      emailVerifiedAt: null,
      reason: 'EMAIL_MISMATCH'
    };
  }

  const emailVerifiedAt = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt }
  });
  await syncUserAccountStatus(userId);

  return {
    synced: true,
    emailVerifiedAt
  };
}
