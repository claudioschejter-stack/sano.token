import { Suspense } from 'react';
import { SecondaryMarketCheckoutView } from '../../../../components/secondaryMarket/SecondaryMarketCheckoutView';

export default function SecondaryMarketCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <SecondaryMarketCheckoutView />
    </Suspense>
  );
}
