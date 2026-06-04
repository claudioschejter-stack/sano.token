import { redirect } from 'next/navigation';
import { collectionWalletHref } from '../../../../lib/navigation/collectionWalletPath';

type WalletCobroPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function WalletCobroPage({ searchParams }: WalletCobroPageProps) {
  const returnTo =
    typeof searchParams?.returnTo === 'string' ? searchParams.returnTo : undefined;
  const preference =
    searchParams?.preference === 'USDC' ? ('USDC' as const) : undefined;

  redirect(collectionWalletHref({ returnTo, preference }));
}
