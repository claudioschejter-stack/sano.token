import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '../../../../../auth';
import { CheckoutView } from '../../../../../components/marketplace/CheckoutView';
import { canAccessMarketplaceCheckout } from '../../../../../lib/onboarding/accountStatus';
import { resolveOperationalWalletAddress } from '../../../../../lib/investor/provisionInvestorProfile';
import { prisma } from '@sanova/database';

type CheckoutPageProps = {
  params: { projectId: string };
};

export default async function MarketplaceCheckoutPage({ params }: CheckoutPageProps) {
  const session = await auth();

  if (!session?.user?.accessToken || !session.user.id) {
    redirect('/acceso');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      kycFullName: true,
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
    redirect(`/kyc?returnTo=/marketplace/${params.projectId}/checkout`);
  }

  return (
    <Suspense fallback={null}>
      <CheckoutView
        projectId={params.projectId}
        investorName={user.kycFullName ?? user.name ?? user.email}
        kycApproved={user.kycStatus === 'APPROVED'}
      />
    </Suspense>
  );
}
