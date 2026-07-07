'use client';

import { useCallback, useRef, useState } from 'react';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../../components/auth/TurnstileWidget';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const widgetRef = useRef<TurnstileWidgetHandle>(null);
  const enabled = Boolean(SITE_KEY);

  const reset = useCallback(() => setToken(null), []);

  const execute = useCallback(async (): Promise<string | null> => {
    if (token) {
      return token;
    }
    if (!widgetRef.current) {
      return null;
    }
    const result = await widgetRef.current.execute();
    if (result) {
      setToken(result);
    }
    return result;
  }, [token]);

  const widget = enabled ? (
    <TurnstileWidget
      ref={widgetRef}
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
    reset,
    execute
  };
}
