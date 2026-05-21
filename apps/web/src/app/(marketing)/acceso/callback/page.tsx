import { Suspense } from 'react';
import AccessCallbackClient from './AccessCallbackClient';

export default function AccessCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
          <p className="text-sm font-medium">Redirigiendo…</p>
        </div>
      }
    >
      <AccessCallbackClient />
    </Suspense>
  );
}
