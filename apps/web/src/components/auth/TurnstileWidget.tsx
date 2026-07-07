'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'invisible';
};

type TurnstileInstance = {
  render: (container: string | HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
  execute: (widgetId: string) => void;
};

// Use type assertion to avoid conflicts with other libraries that also augment window.turnstile
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
};

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SCRIPT_ID = 'cf-turnstile-script';
const EXECUTE_TIMEOUT_MS = 10_000;

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, Props>(function TurnstileWidget(
  { onVerify, onExpire, onError, theme = 'auto' },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingExecuteRef = useRef<((token: string | null) => void) | null>(null);

  const resolvePendingExecute = useCallback((token: string | null) => {
    pendingExecuteRef.current?.(token);
    pendingExecuteRef.current = null;
  }, []);

  const handleVerify = useCallback(
    (token: string) => {
      onVerify(token);
      resolvePendingExecute(token);
    },
    [onVerify, resolvePendingExecute]
  );

  const handleExpire = useCallback(() => {
    widgetIdRef.current = null;
    resolvePendingExecute(null);
    onExpire?.();
  }, [onExpire, resolvePendingExecute]);

  const handleError = useCallback(() => {
    widgetIdRef.current = null;
    resolvePendingExecute(null);
    onError?.();
  }, [onError, resolvePendingExecute]);

  const execute = useCallback((): Promise<string | null> => {
    const ts = getTurnstile();
    const widgetId = widgetIdRef.current;
    if (!ts || !widgetId) {
      return Promise.resolve(null);
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
        ts.execute(widgetId);
      } catch {
        clearTimeout(timeout);
        pendingExecuteRef.current = null;
        resolve(null);
      }
    });
  }, []);

  useImperativeHandle(ref, () => ({ execute }), [execute]);

  const renderWidget = useCallback(() => {
    const ts = getTurnstile();
    if (!containerRef.current || !ts || !SITE_KEY) return;

    if (widgetIdRef.current) {
      ts.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current = ts.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: handleVerify,
      'expired-callback': handleExpire,
      'error-callback': handleError,
      theme,
      size: 'invisible'
    });
  }, [handleVerify, handleExpire, handleError, theme]);

  useEffect(() => {
    if (!SITE_KEY) return;

    if (getTurnstile()) {
      renderWidget();
      return;
    }

    if (!document.getElementById(SCRIPT_ID)) {
      setOnTurnstileLoad(renderWidget);
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
          renderWidget();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [renderWidget]);

  useEffect(() => {
    return () => {
      const ts = getTurnstile();
      if (widgetIdRef.current && ts) {
        ts.remove(widgetIdRef.current);
      }
    };
  }, []);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="sr-only" aria-hidden="true" />;
});
