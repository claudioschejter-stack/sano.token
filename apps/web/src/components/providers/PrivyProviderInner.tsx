'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';
import { privyAppId, privyClientConfig } from '../../lib/privy/config';
import { usePrivySessionSync } from '../../hooks/usePrivySessionSync';

type PrivyProviderInnerProps = {
  children: ReactNode;
};

/**
 * Mounted inside PrivyProvider so it has access to the Privy context.
 * Syncs NextAuth session → Privy automatically when Custom Auth is enabled.
 */
function PrivySessionSyncMount({ children }: { children: ReactNode }) {
  usePrivySessionSync();
  return <>{children}</>;
}

export function PrivyProviderInner({ children }: PrivyProviderInnerProps) {
  return (
    <PrivyProvider appId={privyAppId()} config={privyClientConfig}>
      <PrivySessionSyncMount>{children}</PrivySessionSyncMount>
    </PrivyProvider>
  );
}
