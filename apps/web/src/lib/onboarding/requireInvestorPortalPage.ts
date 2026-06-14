import { redirect } from 'next/navigation';
import { prisma } from '@sanova/database';
import { auth } from '../../auth';
import { canAccessMarketplaceCheckout } from './accountStatus';
import { resolveOperationalWalletAddress } from '../investor/provisionInvestorProfile';

export async function requireInvestorPortalPage(returnTo: string) {
  const session = await auth();

  if (!session?.user?.accessToken || !session.user.id) {
    redirect(`/acceso?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      kycStatus: true,
      accountStatus: true,
      walletAddress: true,
      systemRole: true,
      investor: { select: { walletAddress: true } }
    }
  });

  const walletAddress = user
    ? resolveOperationalWalletAddress(user.walletAddress, user.investor?.walletAddress)
    : null;

  if (!user || !canAccessMarketplaceCheckout({ ...user, walletAddress })) {
    redirect(`/kyc?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return { userId: session.user.id, walletAddress };
}
