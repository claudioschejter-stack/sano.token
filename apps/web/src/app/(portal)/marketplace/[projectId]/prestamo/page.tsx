import { redirect } from 'next/navigation';
import { auth } from '../../../../../auth';
import { ProjectBorrowView } from '../../../../../components/marketplace/ProjectBorrowView';

const MORPHO_BORROW_PAGE_ROLES = new Set(['INVESTOR', 'TREASURY']);

type ProjectBorrowPageProps = {
  params: { projectId: string };
};

export default async function MarketplaceProjectBorrowPage({ params }: ProjectBorrowPageProps) {
  const session = await auth();

  if (!session?.user?.accessToken) {
    redirect(`/acceso?returnTo=/marketplace/${params.projectId}/prestamo`);
  }

  const role = session.user.role;
  if (!role || !MORPHO_BORROW_PAGE_ROLES.has(role)) {
    redirect('/marketplace');
  }

  return <ProjectBorrowView projectId={params.projectId} />;
}
