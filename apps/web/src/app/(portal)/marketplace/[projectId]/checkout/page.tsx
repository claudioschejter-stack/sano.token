'use client';

import { useParams } from 'next/navigation';
import { CheckoutView } from '../../../../../components/marketplace/CheckoutView';

export default function MarketplaceCheckoutPage() {
  const params = useParams<{ projectId: string }>();

  return <CheckoutView projectId={params.projectId} />;
}
