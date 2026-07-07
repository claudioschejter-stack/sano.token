import { Suspense } from 'react';
import { ContinueOnMobileClient } from '../../../../components/kyc/ContinueOnMobileClient';

export default function ContinuarEnCelularPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ContinueOnMobileClient />
    </Suspense>
  );
}
