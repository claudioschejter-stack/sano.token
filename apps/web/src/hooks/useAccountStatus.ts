'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { OnboardingChecklist } from '../lib/onboarding/accountStatus';
import type { OnboardingProfile } from '../lib/onboarding/profile';
import { setDemoKycStatus } from './useKycStatus';

type SystemRole = 'ADMIN' | 'ADVISOR_MANAGER' | 'ADVISOR' | 'INVESTOR' | 'TREASURY' | 'OPERATOR' | null;

export function useAccountStatus() {
  const { data: session, status, update } = useSession();
  const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [systemRole, setSystemRole] = useState<SystemRole>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (status === 'loading') {
      setLoading(true);
      return;
    }

    if (status !== 'authenticated' || !session?.user?.accessToken) {
      setChecklist(null);
      setProfile(null);
      setSystemRole(null);
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
          systemRole?: SystemRole;
        };

        // Persist the operational flag in the JWT/cookie BEFORE exposing it via
        // local state. Otherwise a consumer (e.g. OnboardingView) can redirect
        // to a protected route based on `isOperational` while the session cookie
        // still says the account is not operational, causing the middleware to
        // bounce the user straight back to /kyc (redirect loop).
        if (data.checklist.operational) {
          await update({ accountOperational: true });
        }

        setChecklist(data.checklist);
        setProfile(data.profile ?? null);
        setSystemRole(data.systemRole ?? null);

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
        setSystemRole(null);
      }
    } catch {
      setChecklist(null);
      setProfile(null);
      setSystemRole(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.accessToken, status, update]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    checklist,
    profile,
    systemRole,
    loading,
    refresh,
    isOperational: checklist?.operational ?? false
  };
}
