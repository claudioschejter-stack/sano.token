import { prisma } from '@sanova/database';
import { deriveAccountStatus } from './accountStatus';

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
      systemRole: true
    }
  });

  if (!user) {
    return null;
  }

  const nextStatus = deriveAccountStatus(user);

  if (nextStatus === user.accountStatus) {
    return user;
  }

  return prisma.user.update({
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
}
