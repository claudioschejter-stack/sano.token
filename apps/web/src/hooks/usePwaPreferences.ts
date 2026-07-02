'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

export const PWA_DISMISS_KEY = 'sanova.pwa.banner.dismissed';
export const PWA_INSTALLED_KEY = 'sanova.pwa.installed';
export const PWA_POSTLOGIN_SEEN_KEY = 'sanova.pwa.postlogin.seen';

type PwaPreferencesResponse = {
  pwaInstalledAt?: string | null;
  pwaDismissedAt?: string | null;
};

async function patchPwaPreferences(body: { pwaInstalled?: boolean; pwaDismissed?: boolean }) {
  await fetch('/api/user/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => undefined);
}

export function usePwaPreferences() {
  const { status } = useSession();
  const [dismissed, setDismissedState] = useState(false);
  const [installed, setInstalledState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.localStorage.getItem(PWA_DISMISS_KEY) === '1') {
      setDismissedState(true);
    }

    if (window.localStorage.getItem(PWA_INSTALLED_KEY) === '1') {
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
      .then((data: PwaPreferencesResponse | null) => {
        if (!data) {
          return;
        }

        if (data.pwaInstalledAt) {
          setInstalledState(true);
          window.localStorage.setItem(PWA_INSTALLED_KEY, '1');
        }

        if (data.pwaDismissedAt) {
          setDismissedState(true);
          window.localStorage.setItem(PWA_DISMISS_KEY, '1');
        }
      })
      .finally(() => setLoaded(true));
  }, [status]);

  const setDismissed = useCallback(
    (value: boolean) => {
      setDismissedState(value);
      if (value) {
        window.localStorage.setItem(PWA_DISMISS_KEY, '1');
        if (status === 'authenticated') {
          void patchPwaPreferences({ pwaDismissed: true });
        }
      }
    },
    [status]
  );

  const setInstalled = useCallback(
    (value: boolean) => {
      setInstalledState(value);
      if (value) {
        window.localStorage.setItem(PWA_INSTALLED_KEY, '1');
        if (status === 'authenticated') {
          void patchPwaPreferences({ pwaInstalled: true });
        }
      }
    },
    [status]
  );

  return { dismissed, installed, setDismissed, setInstalled, loaded };
}
