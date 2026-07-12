'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import {
  applyDeviceLocaleOnMobile,
  readLocaleManualFlag,
  resetMobileLocaleOnSignOut
} from '../../lib/i18n/mobileLocalePreference';
import { isMobileDevice } from '../../lib/mobile/deviceConfig';

/**
 * Resets mobile locale to the device language right after a genuine
 * sign-out (or on first load, before any session exists) — keeps the
 * pinned/manually-chosen locale during active sessions.
 *
 * This must NOT re-run every time `locale` changes while the user simply
 * sits on the (unauthenticated) login screen — an earlier version depended
 * on `locale` and re-applied the device language on every change, which
 * silently reverted any language picked from the login page's switcher
 * back to the device's language a moment later.
 */
export function SessionLocaleSync() {
  const { status } = useSession();
  const { setLocale } = useLocale();
  const previousStatusRef = useRef<typeof status | null>(null);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;

    if (!isMobileDevice() || status !== 'unauthenticated') {
      return;
    }

    // Only react to an actual transition into "unauthenticated" (fresh load
    // or sign-out) — not to re-renders that happen while already sitting on
    // the login screen, which is when a manual language change fires.
    if (previousStatus === 'unauthenticated') {
      return;
    }

    // A language the user just picked on purpose must never be overridden.
    if (readLocaleManualFlag()) {
      return;
    }

    resetMobileLocaleOnSignOut();
    const deviceLocale = applyDeviceLocaleOnMobile();
    setLocale(deviceLocale);
  }, [setLocale, status]);

  return null;
}
