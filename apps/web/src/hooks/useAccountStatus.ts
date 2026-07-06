'use client';

import { useOnboardingStatusContext } from '../components/providers/OnboardingStatusProvider';
import {
  useAccountStatusState,
  type AccountStatusState
} from './useAccountStatusState';

export type { AccountStatusState };

export function useAccountStatus(): AccountStatusState {
  const shared = useOnboardingStatusContext();
  const local = useAccountStatusState({ enabled: shared === null });

  return shared ?? local;
}
