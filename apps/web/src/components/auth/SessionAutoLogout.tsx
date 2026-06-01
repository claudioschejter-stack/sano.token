'use client';

import { signOut, useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';
import {
  JWT_STORAGE_KEY,
  SESSION_INACTIVITY_MS,
  SESSION_LOGOUT_BROADCAST_KEY
} from '../../lib/auth/sessionAutoLogout';

type LogoutReason = 'inactivity' | 'pagehide' | 'broadcast';

function beaconLogout() {
  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon('/api/auth/beacon-logout', new Blob([], { type: 'application/json' }));
    return;
  }

  void fetch('/api/auth/beacon-logout', {
    method: 'POST',
    keepalive: true,
    credentials: 'same-origin'
  }).catch(() => {});
}

export function SessionAutoLogout() {
  const { status } = useSession();
  const timerRef = useRef<number | null>(null);
  const loggingOutRef = useRef(false);

  const clearClientSession = useCallback(() => {
    window.localStorage.removeItem(JWT_STORAGE_KEY);
  }, []);

  const broadcastLogout = useCallback(() => {
    try {
      window.localStorage.setItem(SESSION_LOGOUT_BROADCAST_KEY, String(Date.now()));
    } catch {
      // Storage may be unavailable in private mode.
    }
  }, []);

  const performLogout = useCallback(
    async (reason: LogoutReason) => {
      if (loggingOutRef.current || status !== 'authenticated') {
        return;
      }

      loggingOutRef.current = true;
      clearClientSession();

      if (reason === 'pagehide') {
        beaconLogout();
        broadcastLogout();
        return;
      }

      broadcastLogout();

      if (reason === 'broadcast') {
        await signOut({ callbackUrl: '/acceso' });
        return;
      }

      await signOut({ callbackUrl: '/acceso' });
    },
    [broadcastLogout, clearClientSession, status]
  );

  useEffect(() => {
    if (status !== 'authenticated') {
      loggingOutRef.current = false;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    loggingOutRef.current = false;

    const scheduleInactivityLogout = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        void performLogout('inactivity');
      }, SESSION_INACTIVITY_MS);
    };

    const onActivity = () => {
      scheduleInactivityLogout();
    };

    const onPageHide = () => {
      void performLogout('pagehide');
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_LOGOUT_BROADCAST_KEY && event.newValue) {
        void performLogout('broadcast');
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'mousemove'
    ];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        scheduleInactivityLogout();
      }
    });

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('storage', onStorage);

    scheduleInactivityLogout();

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, onActivity);
      }

      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('storage', onStorage);
    };
  }, [performLogout, status]);

  return null;
}
