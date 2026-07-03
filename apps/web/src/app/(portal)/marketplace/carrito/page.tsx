import { redirect } from 'next/navigation';
import { auth } from '../../../../auth';
import { CartCheckoutView } from '../../../../components/marketplace/CartCheckoutView';
import { canAccessMarketplaceCheckout } from '../../../../lib/onboarding/accountStatus';
import { prisma } from '@sanova/database';

import { resolveOperationalWalletAddress } from '../../../../lib/investor/provisionInvestorProfile';
import { collectionWalletHref } from '../../../../lib/navigation/collectionWalletPath';

type CartPageProps = {
  searchParams: { mode?: string; returnTo?: string; preference?: string };
};

export default async function MarketplaceCartPage({ searchParams }: CartPageProps) {
  const session = await auth();

  if (!session?.user?.accessToken || !session.user.id) {
    redirect('/acceso?returnTo=/marketplace/carrito');
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
      totpEnabled: true,
      investor: { select: { walletAddress: true } }
    }
  });

  const walletAddress = user
    ? resolveOperationalWalletAddress(user.walletAddress, user.investor?.walletAddress)
    : null;

  if (searchParams.mode === 'wallet') {
    redirect(
      collectionWalletHref({
        returnTo: searchParams.returnTo ?? '/dashboard',
        preference: searchParams.preference === 'USDC' ? 'USDC' : undefined
      })
    );
  }

  const mode = searchParams.mode === 'deposit' ? 'deposit' : 'purchase';
  const returnPath =
    mode === 'deposit' ? '/marketplace/carrito?mode=deposit' : '/marketplace/carrito';

  if (!user || !canAccessMarketplaceCheckout({ ...user, walletAddress })) {
    redirect(`/kyc?returnTo=${encodeURIComponent(returnPath)}`);
  }

  return (
    <CartCheckoutView
      investorName={user.kycFullName ?? user.name ?? user.email}
      initialMode={mode}
    />
  );
}
