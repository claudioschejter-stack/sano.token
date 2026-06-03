import { redirect } from 'next/navigation';
import { auth } from '../../../../auth';
import { PlatformWalletView } from '../../../../components/wallet/PlatformWalletView';

type WalletPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function WalletPage({ searchParams }: WalletPageProps) {
  const session = await auth();
  const role = session?.user?.role;

  if (role === 'INVESTOR') {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (typeof value === 'string') {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        for (const entry of value) {
          params.append(key, entry);
        }
      }
    }

    const query = params.toString();
    redirect(query ? `/dashboard/portfolio?${query}` : '/dashboard/portfolio');
  }

  return <PlatformWalletView />;
}
