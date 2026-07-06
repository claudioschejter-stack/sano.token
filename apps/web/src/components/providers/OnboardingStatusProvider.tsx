'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  useAccountStatusState,
  type AccountStatusState
} from '../../hooks/useAccountStatusState';

const OnboardingStatusContext = createContext<AccountStatusState | null>(null);

export function OnboardingStatusProvider({ children }: { children: ReactNode }) {
  const value = useAccountStatusState();
  return (
    <OnboardingStatusContext.Provider value={value}>{children}</OnboardingStatusContext.Provider>
  );
}

export function useOnboardingStatusContext(): AccountStatusState | null {
  return useContext(OnboardingStatusContext);
}
