import { Suspense } from 'react';
import { ActivateAccountClient } from '../../../../components/auth/ActivateAccountClient';

export default function ActivarCuentaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ActivateAccountClient />
    </Suspense>
  );
}
