'use client';

import { useCallback, useState } from 'react';
import { TurnstileWidget } from '../../components/auth/TurnstileWidget';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const enabled = Boolean(SITE_KEY);

  const reset = useCallback(() => setToken(null), []);

  const widget = enabled ? (
    <TurnstileWidget
      onVerify={setToken}
      onExpire={reset}
      onError={reset}
    />
  ) : null;

  return {
    enabled,
    token,
    ready: !enabled || Boolean(token),
    widget,
    reset
  };
}
