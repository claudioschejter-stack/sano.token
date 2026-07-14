import { prisma } from '@sanova/database';

export async function getLoansEnabledForUser(userId: string): Promise<boolean | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      investor: {
        select: { loansEnabled: true }
      }
    }
  });

  if (!user?.investor) {
    return null;
  }

  return user.investor.loansEnabled;
}

export async function updateLoansEnabledForUser(userId: string, loansEnabled: boolean): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { investorId: true }
  });

  if (!user?.investorId) {
    throw new Error('INVESTOR_NOT_FOUND');
  }

  const investor = await prisma.investor.update({
    where: { id: user.investorId },
    data: { loansEnabled },
    select: { loansEnabled: true }
  });

  return investor.loansEnabled;
}
