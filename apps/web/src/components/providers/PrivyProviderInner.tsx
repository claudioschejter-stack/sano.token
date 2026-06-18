'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';
import { privyAppId, privyClientConfig } from '../../lib/privy/config';

type PrivyProviderInnerProps = {
  children: ReactNode;
};

export function PrivyProviderInner({ children }: PrivyProviderInnerProps) {
  return (
    <PrivyProvider appId={privyAppId()} config={privyClientConfig}>
      {children}
    </PrivyProvider>
  );
}
