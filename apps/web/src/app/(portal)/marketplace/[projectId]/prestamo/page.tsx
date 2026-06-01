import { redirect } from 'next/navigation';
import { auth } from '../../../../../auth';
import { ProjectBorrowView } from '../../../../../components/marketplace/ProjectBorrowView';

type ProjectBorrowPageProps = {
  params: { projectId: string };
};

export default async function MarketplaceProjectBorrowPage({ params }: ProjectBorrowPageProps) {
  const session = await auth();

  if (!session?.user?.accessToken) {
    redirect(`/acceso?returnTo=/marketplace/${params.projectId}/prestamo`);
  }

  if (session.user.role !== 'INVESTOR') {
    redirect('/marketplace');
  }

  return <ProjectBorrowView projectId={params.projectId} />;
}
