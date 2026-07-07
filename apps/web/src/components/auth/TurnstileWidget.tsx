'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => boolean | void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'invisible';
  execution?: 'render' | 'execute';
};

type TurnstileInstance = {
  render: (container: string | HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
  execute: (widgetIdOrContainer: string | HTMLElement) => void;
  getResponse?: (widgetId: string) => string | undefined;
  ready?: (callback: () => void) => void;
};

const getTurnstile = (): TurnstileInstance | undefined =>
  (window as unknown as { turnstile?: TurnstileInstance }).turnstile;

const setOnTurnstileLoad = (fn: () => void) => {
  (window as unknown as { onTurnstileLoad?: () => void }).onTurnstileLoad = fn;
};

type Props = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
};

export type TurnstileWidgetHandle = {
  execute: () => Promise<string | null>;
  isReady: () => boolean;
};

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SCRIPT_ID = 'cf-turnstile-script';
const EXECUTE_TIMEOUT_MS = 15_000;
const MAX_EXECUTE_ATTEMPTS = 3;

function waitForTurnstileApi(): Promise<TurnstileInstance> {
  return new Promise((resolve, reject) => {
    const existing = getTurnstile();
    if (existing?.ready) {
      existing.ready(() => {
        const ts = getTurnstile();
        if (ts) {
          resolve(ts);
          return;
        }
        reject(new Error('turnstile unavailable'));
      });
      return;
    }

    if (existing) {
      resolve(existing);
      return;
    }

    const deadline = Date.now() + 10_000;
    const interval = setInterval(() => {
      const ts = getTurnstile();
      if (ts) {
        clearInterval(interval);
        if (ts.ready) {
          ts.ready(() => resolve(ts));
        } else {
          resolve(ts);
        }
        return;
      }

      if (Date.now() >= deadline) {
        clearInterval(interval);
        reject(new Error('turnstile script timeout'));
      }
    }, 100);
  });
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, Props>(function TurnstileWidget(
  { onVerify, onExpire, onError, theme = 'auto' },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingExecuteRef = useRef<((token: string | null) => void) | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  const resolvePendingExecute = useCallback((token: string | null) => {
    pendingExecuteRef.current?.(token);
    pendingExecuteRef.current = null;
  }, []);

  const resetWidget = useCallback((widgetId: string) => {
    const ts = getTurnstile();
    if (!ts) {
      return;
    }

    try {
      ts.reset(widgetId);
    } catch {
      // ignore reset failures
    }
  }, []);

  const renderWidget = useCallback(() => {
    const ts = getTurnstile();
    const container = containerRef.current;
    if (!container || !ts || !SITE_KEY) {
      return false;
    }

    if (widgetIdRef.current) {
      return true;
    }

    widgetIdRef.current = ts.render(container, {
      sitekey: SITE_KEY,
      callback: (token: string) => {
        onVerifyRef.current(token);
        resolvePendingExecute(token);
      },
      'expired-callback': () => {
        resolvePendingExecute(null);
        onExpireRef.current?.();
        const widgetId = widgetIdRef.current;
        if (widgetId) {
          resetWidget(widgetId);
        }
      },
      'error-callback': () => {
        resolvePendingExecute(null);
        onErrorRef.current?.();
        const widgetId = widgetIdRef.current;
        if (widgetId) {
          resetWidget(widgetId);
        }
        return true;
      },
      theme,
      size: 'invisible',
      execution: 'execute'
    });

    return Boolean(widgetIdRef.current);
  }, [resetWidget, resolvePendingExecute, theme]);

  const ensureWidget = useCallback(async (): Promise<boolean> => {
    try {
      await waitForTurnstileApi();
    } catch {
      return false;
    }

    if (widgetIdRef.current) {
      return true;
    }

    return renderWidget();
  }, [renderWidget]);

  const readExistingToken = useCallback((): string | null => {
    const ts = getTurnstile();
    const widgetId = widgetIdRef.current;
    if (!ts || !widgetId || !ts.getResponse) {
      return null;
    }

    const existing = ts.getResponse(widgetId);
    return existing || null;
  }, []);

  const executeOnce = useCallback(
    async (attempt: number): Promise<string | null> => {
      const ready = await ensureWidget();
      const ts = getTurnstile();
      const container = containerRef.current;
      const widgetId = widgetIdRef.current;

      if (!ready || !ts || !container || !widgetId) {
        return null;
      }

      const existing = readExistingToken();
      if (existing) {
        onVerifyRef.current(existing);
        return existing;
      }

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pendingExecuteRef.current = null;
          resolve(null);
        }, EXECUTE_TIMEOUT_MS);

        pendingExecuteRef.current = (token) => {
          clearTimeout(timeout);
          resolve(token);
        };

        try {
          if (attempt > 0) {
            resetWidget(widgetId);
          }
          ts.execute(container);
        } catch {
          clearTimeout(timeout);
          pendingExecuteRef.current = null;
          resolve(null);
        }
      });
    },
    [ensureWidget, readExistingToken, resetWidget]
  );

  const execute = useCallback(async (): Promise<string | null> => {
    for (let attempt = 0; attempt < MAX_EXECUTE_ATTEMPTS; attempt++) {
      const token = await executeOnce(attempt);
      if (token) {
        return token;
      }
    }

    return null;
  }, [executeOnce]);

  const isReady = useCallback(() => Boolean(widgetIdRef.current && getTurnstile()), []);

  useImperativeHandle(ref, () => ({ execute, isReady }), [execute, isReady]);

  useEffect(() => {
    if (!SITE_KEY) {
      return;
    }

    let cancelled = false;

    const boot = () => {
      if (cancelled) {
        return;
      }
      void ensureWidget();
    };

    if (getTurnstile()) {
      boot();
      return () => {
        cancelled = true;
      };
    }

    if (!document.getElementById(SCRIPT_ID)) {
      setOnTurnstileLoad(boot);
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if (getTurnstile()) {
          clearInterval(interval);
          boot();
        }
      }, 100);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [ensureWidget]);

  useEffect(() => {
    return () => {
      const ts = getTurnstile();
      if (widgetIdRef.current && ts) {
        ts.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0"
      aria-hidden="true"
    />
  );
});
