import { redirect } from 'next/navigation';
import { auth } from '../../../../../auth';
import { CheckoutView } from '../../../../../components/marketplace/CheckoutView';
import { isAccountOperational } from '../../../../../lib/onboarding/accountStatus';
import { prisma } from '@sanova/database';

type CheckoutPageProps = {
  params: { projectId: string };
};

export default async function MarketplaceCheckoutPage({ params }: CheckoutPageProps) {
  const session = await auth();

  if (!session?.user?.accessToken || !session.user.id) {
    redirect('/acceso');
  }

  if (session.user.role && session.user.role !== 'INVESTOR') {
    redirect('/marketplace');
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
      accountStatus: true
    }
  });

  if (!user || !isAccountOperational(user)) {
    redirect(`/kyc?returnTo=/marketplace/${params.projectId}/checkout`);
  }

  return (
    <CheckoutView
      projectId={params.projectId}
      investorName={user.kycFullName ?? user.name ?? user.email}
      kycApproved={user.kycStatus === 'APPROVED'}
    />
  );
}
