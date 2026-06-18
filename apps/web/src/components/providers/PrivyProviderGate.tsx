'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';
import { isPrivyEnabled, privyAppId, privyClientConfig } from '../../lib/privy/config';

type PrivyProviderGateProps = {
  children: ReactNode;
};

export function PrivyProviderGate({ children }: PrivyProviderGateProps) {
  if (!isPrivyEnabled()) {
    return children;
  }

  return (
    <PrivyProvider appId={privyAppId()} config={privyClientConfig}>
      {children}
    </PrivyProvider>
  );
}
