'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

  // `update` (from next-auth's useSession) is NOT reference-stable: it is
  // rebuilt whenever the session/loading state changes internally, including
  // as a *result* of calling it. Depending on it directly from `refresh`
  // would recreate `refresh` on every call, re-triggering the mount effect
  // below and creating a self-sustaining refetch loop (visible as UI flicker
  // and, in the onboarding view, a permanently stuck loading state). Reading
  // it through a ref keeps `refresh`'s identity stable.
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  const accountOperational = session?.user?.accountOperational;

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

        setChecklist(data.checklist);
        setProfile(data.profile ?? null);
        setSystemRole(data.systemRole ?? null);

        // Only push the operational flag into the JWT/cookie when the session
        // doesn't already reflect it. Calling `update()` unconditionally on
        // every refresh is what causes the refetch loop described above.
        if (data.checklist.operational && accountOperational !== true) {
          await updateRef.current({ accountOperational: true });
        }

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
  }, [accountOperational, session?.user?.accessToken, status]);

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
