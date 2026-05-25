'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { OnboardingChecklist } from '../lib/onboarding/accountStatus';
import type { OnboardingProfile } from '../lib/onboarding/profile';
import { setDemoKycStatus } from './useKycStatus';

export function useAccountStatus() {
  const { data: session, status } = useSession();
  const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (status === 'loading') {
      setLoading(true);
      return;
    }

    if (status !== 'authenticated' || !session?.user?.accessToken) {
      setChecklist(null);
      setProfile(null);
      setLoading(status === 'authenticated');
      return;
    }

    setLoading((current) => (options?.silent ? current : true));

    try {
      const response = await fetch('/api/onboarding/status', {
        cache: 'no-store',
        credentials: 'same-origin'
      });

      if (response.ok) {
        const data = (await response.json()) as {
          checklist: OnboardingChecklist;
          profile?: OnboardingProfile;
        };
        setChecklist(data.checklist);
        setProfile(data.profile ?? null);

        if (data.checklist.kycApproved) {
          setDemoKycStatus('APPROVED');
        } else if (data.checklist.kycStatus === 'REJECTED') {
          setDemoKycStatus('REJECTED');
        } else {
          setDemoKycStatus('PENDING');
        }
      } else {
        setChecklist(null);
        setProfile(null);
      }
    } catch {
      setChecklist(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.accessToken, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    checklist,
    profile,
    loading,
    refresh,
    isOperational: checklist?.operational ?? false
  };
}
