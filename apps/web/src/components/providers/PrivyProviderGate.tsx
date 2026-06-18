'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { isPrivyEnabled } from '../../lib/privy/config';

const PrivyProviderInner = dynamic(
  () => import('./PrivyProviderInner').then((module) => module.PrivyProviderInner),
  { ssr: false }
);

type PrivyProviderGateProps = {
  children: ReactNode;
};

export function PrivyProviderGate({ children }: PrivyProviderGateProps) {
  if (!isPrivyEnabled()) {
    return children;
  }

  return <PrivyProviderInner>{children}</PrivyProviderInner>;
}
