import { prisma } from '@sanova/database';
import { deriveAccountStatus } from './accountStatus';
import { maybeSendAccountApprovedEmail } from './accountOperationalNotification';

export async function syncUserAccountStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      kycStatus: true,
      accountStatus: true,
      walletAddress: true,
      systemRole: true,
      totpEnabled: true
    }
  });

  if (!user) {
    return null;
  }

  const nextStatus = deriveAccountStatus(user);

  if (nextStatus === user.accountStatus) {
    return user;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: nextStatus },
    select: {
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      kycStatus: true,
      accountStatus: true
    }
  });

  // Also requires the Sanova app installed on mobile (`pwaInstalledAt`), not
  // just KYC + wallet + TOTP — see `maybeSendAccountApprovedEmail` for the
  // full gating logic. Safe to call unconditionally: it's a no-op unless
  // every condition is met and it hasn't already fired.
  if (nextStatus === 'OPERATIONAL') {
    void maybeSendAccountApprovedEmail(userId);
  }

  return updated;
}
