'use client';

import { useCallback, useRef, useState, type RefObject } from 'react';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../../components/auth/TurnstileWidget';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const WIDGET_WAIT_MS = 3_000;
const WIDGET_POLL_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForWidgetRef(
  widgetRef: RefObject<TurnstileWidgetHandle | null>
): Promise<TurnstileWidgetHandle | null> {
  const deadline = Date.now() + WIDGET_WAIT_MS;

  while (Date.now() < deadline) {
    if (widgetRef.current) {
      return widgetRef.current;
    }
    await sleep(WIDGET_POLL_MS);
  }

  return widgetRef.current;
}

export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const widgetRef = useRef<TurnstileWidgetHandle>(null);
  const enabled = Boolean(SITE_KEY);

  const reset = useCallback(() => setToken(null), []);

  const execute = useCallback(async (): Promise<string | null> => {
    if (token) {
      return token;
    }

    const widget = widgetRef.current ?? (await waitForWidgetRef(widgetRef));
    if (!widget) {
      return null;
    }

    const result = await widget.execute();
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
