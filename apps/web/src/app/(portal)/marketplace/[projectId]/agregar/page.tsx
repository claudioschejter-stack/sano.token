import { redirect } from 'next/navigation';
import { prisma } from '@sanova/database';
import { auth } from '../../../../../auth';
import { AddToCartView } from '../../../../../components/marketplace/AddToCartView';
import { canAccessMarketplaceCheckout } from '../../../../../lib/onboarding/accountStatus';
import { resolveOperationalWalletAddress } from '../../../../../lib/investor/provisionInvestorProfile';

type AddToCartPageProps = {
  params: { projectId: string };
};

export default async function AddToCartPage({ params }: AddToCartPageProps) {
  const session = await auth();

  if (!session?.user?.accessToken || !session.user.id) {
    redirect(`/acceso?returnTo=${encodeURIComponent(`/marketplace/${params.projectId}/agregar`)}`);
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
      totpEnabled: true,
      investor: { select: { walletAddress: true } }
    }
  });

  const walletAddress = user
    ? resolveOperationalWalletAddress(user.walletAddress, user.investor?.walletAddress)
    : null;

  if (!user || !canAccessMarketplaceCheckout({ ...user, walletAddress })) {
    redirect(`/kyc?returnTo=${encodeURIComponent(`/marketplace/${params.projectId}/agregar`)}`);
  }

  return <AddToCartView projectId={params.projectId} />;
}
