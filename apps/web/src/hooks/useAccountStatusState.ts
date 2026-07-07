'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { OnboardingChecklist } from '../lib/onboarding/accountStatus';
import type { OnboardingProfile } from '../lib/onboarding/profile';
import { setDemoKycStatus } from './useKycStatus';

type SystemRole = 'ADMIN' | 'ADVISOR_MANAGER' | 'ADVISOR' | 'INVESTOR' | 'TREASURY' | 'OPERATOR' | null;

export type AccountStatusState = {
  checklist: OnboardingChecklist | null;
  profile: OnboardingProfile | null;
  systemRole: SystemRole;
  registrationChannel: string | null;
  onboardingSuccessShownAt: string | null;
  diditSessionId: string | null;
  loading: boolean;
  fetchError: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  isOperational: boolean;
};

export function useAccountStatusState(options?: { enabled?: boolean }): AccountStatusState {
  const enabled = options?.enabled !== false;
  const { data: session, status, update } = useSession();
  const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [systemRole, setSystemRole] = useState<SystemRole>(null);
  const [registrationChannel, setRegistrationChannel] = useState<string | null>(null);
  const [onboardingSuccessShownAt, setOnboardingSuccessShownAt] = useState<string | null>(null);
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  const accountOperational = session?.user?.accountOperational;

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) {
      return;
    }

    if (status === 'loading') {
      setLoading(true);
      return;
    }

    if (status !== 'authenticated' || !session?.user?.accessToken) {
      setChecklist(null);
      setProfile(null);
      setSystemRole(null);
      setRegistrationChannel(null);
      setOnboardingSuccessShownAt(null);
      setDiditSessionId(null);
      setFetchError(null);
      setLoading(status === 'authenticated');
      return;
    }

    setLoading((current) => (options?.silent ? current : true));
    if (!options?.silent) {
      setFetchError(null);
    }

    try {
      const response = await fetch('/api/onboarding/status', {
        cache: 'no-store',
        credentials: 'same-origin'
      });

      if (response.ok) {
        const data = (await response.json()) as {
          checklist: OnboardingChecklist;
          profile?: OnboardingProfile;
          systemRole?: SystemRole;
          registrationChannel?: string | null;
          onboardingSuccessShownAt?: string | null;
          diditSessionId?: string | null;
        };

        setFetchError(null);
        setChecklist(data.checklist);
        setProfile(data.profile ?? null);
        setSystemRole(data.systemRole ?? null);
        setRegistrationChannel(data.registrationChannel ?? null);
        setOnboardingSuccessShownAt(data.onboardingSuccessShownAt ?? null);
        setDiditSessionId(data.diditSessionId ?? null);

        if (data.checklist.operational && accountOperational !== true) {
          await updateRef.current({});
        }

        if (data.checklist.kycApproved) {
          setDemoKycStatus('APPROVED');
        } else if (data.checklist.kycStatus === 'REJECTED') {
          setDemoKycStatus('REJECTED');
        } else {
          setDemoKycStatus('PENDING');
        }
      } else {
        if (!options?.silent) {
          setChecklist(null);
          setProfile(null);
          setSystemRole(null);
        }
        setFetchError('STATUS_FETCH_FAILED');
      }
    } catch {
      if (!options?.silent) {
        setChecklist(null);
        setProfile(null);
        setSystemRole(null);
      }
      setFetchError('STATUS_FETCH_FAILED');
    } finally {
      setLoading(false);
    }
  }, [accountOperational, enabled, session?.user?.accessToken, status]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  return {
    checklist,
    profile,
    systemRole,
    registrationChannel,
    onboardingSuccessShownAt,
    diditSessionId,
    loading,
    fetchError,
    refresh,
    isOperational: checklist?.operational ?? false
  };
}
