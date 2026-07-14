'use client';

import { useCallback, useEffect, useState } from 'react';

const LOANS_PREFERENCE_EVENT = 'sanova:loans-preference';

type LoansPreferenceState = {
  loansEnabled: boolean;
  loading: boolean;
  error: string | null;
  setLoansEnabled: (enabled: boolean) => Promise<boolean>;
  refresh: () => Promise<void>;
};

function broadcastLoansEnabled(loansEnabled: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOANS_PREFERENCE_EVENT, { detail: { loansEnabled } }));
}

export function useLoansPreference(): LoansPreferenceState {
  const [loansEnabled, setLoansEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/investor/loans-preference', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) {
        setLoansEnabledState(false);
        setError('LOAD_FAILED');
        return;
      }
      const data = (await response.json()) as { loansEnabled?: boolean };
      setLoansEnabledState(Boolean(data.loansEnabled));
    } catch {
      setLoansEnabledState(false);
      setError('LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onPreference(event: Event) {
      const detail = (event as CustomEvent<{ loansEnabled?: boolean }>).detail;
      if (typeof detail?.loansEnabled === 'boolean') {
        setLoansEnabledState(detail.loansEnabled);
      }
    }
    window.addEventListener(LOANS_PREFERENCE_EVENT, onPreference);
    return () => window.removeEventListener(LOANS_PREFERENCE_EVENT, onPreference);
  }, []);

  const setLoansEnabled = useCallback(async (enabled: boolean) => {
    setError(null);
    try {
      const response = await fetch('/api/investor/loans-preference', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ loansEnabled: enabled })
      });
      if (!response.ok) {
        setError('UPDATE_FAILED');
        return false;
      }
      const data = (await response.json()) as { loansEnabled?: boolean };
      const next = Boolean(data.loansEnabled);
      setLoansEnabledState(next);
      broadcastLoansEnabled(next);
      return true;
    } catch {
      setError('UPDATE_FAILED');
      return false;
    }
  }, []);

  return { loansEnabled, loading, error, setLoansEnabled, refresh };
}
