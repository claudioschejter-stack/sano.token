import { redirect } from 'next/navigation';
import { auth } from '../../../../../auth';
import { ProjectBorrowView } from '../../../../../components/marketplace/ProjectBorrowView';
import { getLinkedWalletForUser } from '../../../../../lib/investor/linkedWalletPolicy';
import { assertOperationalInvestor, getUserPurchaseContext } from '../../../../../lib/investor/investorService';
import { collectionWalletHref } from '../../../../../lib/navigation/collectionWalletPath';

const MORPHO_BORROW_PAGE_ROLES = new Set(['INVESTOR']);

type ProjectBorrowPageProps = {
  params: { projectId: string };
};

export default async function MarketplaceProjectBorrowPage({ params }: ProjectBorrowPageProps) {
  const session = await auth();
  const returnTo = `/marketplace/${params.projectId}/prestamo`;

  if (!session?.user?.accessToken) {
    redirect(`/acceso?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const role = session.user.role;
  if (!role || !MORPHO_BORROW_PAGE_ROLES.has(role)) {
    redirect('/marketplace');
  }

  const userId = session.user.id;
  if (!userId) {
    redirect(`/acceso?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const user = await getUserPurchaseContext(userId);
  if (!user) {
    redirect(`/acceso?returnTo=${encodeURIComponent(returnTo)}`);
  }

  try {
    assertOperationalInvestor(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'KYC_NOT_APPROVED') {
      redirect(`/kyc?returnTo=${encodeURIComponent(returnTo)}`);
    }
    redirect(collectionWalletHref({ returnTo }));
  }

  const linkedWallet = await getLinkedWalletForUser(userId);
  if (!linkedWallet) {
    redirect(collectionWalletHref({ returnTo }));
  }

  return <ProjectBorrowView projectId={params.projectId} />;
}
