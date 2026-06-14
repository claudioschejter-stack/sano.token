import { redirect } from 'next/navigation';
import { prisma, type AccountStatus, type KycStatus } from '@sanova/database';
import { auth } from '../../auth';
import {
  canAccessCashFlowDashboard,
  canAccessMarketplaceCheckout
} from './accountStatus';
import { resolveOperationalWalletAddress } from '../investor/provisionInvestorProfile';

type PortalUserFields = {
  email: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
  walletAddress: string | null;
  systemRole: string | null;
};

async function loadPortalUser(userId: string): Promise<PortalUserFields | null> {
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
      investor: { select: { walletAddress: true } }
    }
  });

  if (!user) {
    return null;
  }

  const walletAddress = resolveOperationalWalletAddress(
    user.walletAddress,
    user.investor?.walletAddress
  );

  return { ...user, walletAddress };
}

export async function requireInvestorPortalPage(returnTo: string) {
  const session = await auth();

  if (!session?.user?.accessToken || !session.user.id) {
    redirect(`/acceso?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const user = await loadPortalUser(session.user.id);

  if (!user || !canAccessMarketplaceCheckout(user)) {
    redirect(`/kyc?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return { userId: session.user.id, walletAddress: user.walletAddress };
}

export async function requireCashFlowPortalPage(returnTo: string) {
  const session = await auth();

  if (!session?.user?.accessToken || !session.user.id) {
    redirect(`/acceso?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const user = await loadPortalUser(session.user.id);

  if (!user || !canAccessCashFlowDashboard(user)) {
    redirect(`/kyc?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return { userId: session.user.id, walletAddress: user.walletAddress };
}
