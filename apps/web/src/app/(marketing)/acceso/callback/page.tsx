import { Suspense } from 'react';
import AccessCallbackClient from './AccessCallbackClient';
import { AccessRedirectFallback } from './AccessRedirectFallback';

export default function AccessCallbackPage() {
  return (
    <Suspense fallback={<AccessRedirectFallback />}>
      <AccessCallbackClient />
    </Suspense>
  );
}
