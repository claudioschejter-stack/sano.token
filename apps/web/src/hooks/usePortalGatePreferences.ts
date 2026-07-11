'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

// Deliberately separate from PWA_DISMISS_KEY/PWA_INSTALLED_KEY in
// usePwaPreferences.ts (owned by the legacy desktop InstallAppBanner) and
// their pwaInstalledAt/pwaDismissedAt DB columns. This hook backs only the
// mobile-browser post-login install gate (usePortalInstallGate), so a past
// interaction with one surface never permanently suppresses the other.
export const PORTAL_GATE_DISMISS_KEY = 'sanova.pwa.portalGate.dismissed';
export const PORTAL_GATE_INSTALLED_KEY = 'sanova.pwa.portalGate.installed';

type PortalGatePreferencesResponse = {
  pwaPortalGateInstalledAt?: string | null;
  pwaPortalGateDismissedAt?: string | null;
};

async function patchPortalGatePreferences(body: { pwaPortalGateInstalled?: boolean; pwaPortalGateDismissed?: boolean }) {
  await fetch('/api/user/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => undefined);
}

export function usePortalGatePreferences() {
  const { status } = useSession();
  const [dismissed, setDismissedState] = useState(false);
  const [installed, setInstalledState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.localStorage.getItem(PORTAL_GATE_DISMISS_KEY) === '1') {
      setDismissedState(true);
    }

    if (window.localStorage.getItem(PORTAL_GATE_INSTALLED_KEY) === '1') {
      setInstalledState(true);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status !== 'authenticated') {
      setLoaded(true);
      return;
    }

    void fetch('/api/user/preferences', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PortalGatePreferencesResponse | null) => {
        if (!data) {
          return;
        }

        if (data.pwaPortalGateInstalledAt) {
          setInstalledState(true);
          window.localStorage.setItem(PORTAL_GATE_INSTALLED_KEY, '1');
        }

        if (data.pwaPortalGateDismissedAt) {
          setDismissedState(true);
          window.localStorage.setItem(PORTAL_GATE_DISMISS_KEY, '1');
        }
      })
      .finally(() => setLoaded(true));
  }, [status]);

  const setDismissed = useCallback(
    (value: boolean) => {
      setDismissedState(value);
      if (value) {
        window.localStorage.setItem(PORTAL_GATE_DISMISS_KEY, '1');
        if (status === 'authenticated') {
          void patchPortalGatePreferences({ pwaPortalGateDismissed: true });
        }
      }
    },
    [status]
  );

  const setInstalled = useCallback(
    (value: boolean) => {
      setInstalledState(value);
      if (value) {
        window.localStorage.setItem(PORTAL_GATE_INSTALLED_KEY, '1');
        if (status === 'authenticated') {
          void patchPortalGatePreferences({ pwaPortalGateInstalled: true });
        }
      }
    },
    [status]
  );

  return { dismissed, installed, setDismissed, setInstalled, loaded };
}
