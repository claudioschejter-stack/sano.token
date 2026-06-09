import { redirect } from 'next/navigation';
import { auth } from '../../../../../auth';
import { AddToCartView } from '../../../../../components/marketplace/AddToCartView';

type AddToCartPageProps = {
  params: { projectId: string };
};

export default async function AddToCartPage({ params }: AddToCartPageProps) {
  const session = await auth();

  if (!session?.user?.accessToken) {
    redirect(`/acceso?returnTo=${encodeURIComponent(`/marketplace/${params.projectId}/agregar`)}`);
  }

  return <AddToCartView projectId={params.projectId} />;
}
