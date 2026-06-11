'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import {
  applyDeviceLocaleOnMobile,
  resetMobileLocaleOnSignOut
} from '../../lib/i18n/mobileLocalePreference';
import { isMobileDevice } from '../../lib/mobile/deviceConfig';

/** Resets mobile locale to the device language after sign-out; keeps pinned locale during active sessions. */
export function SessionLocaleSync() {
  const { status } = useSession();
  const { locale, setLocale } = useLocale();

  useEffect(() => {
    if (!isMobileDevice() || status !== 'unauthenticated') {
      return;
    }

    resetMobileLocaleOnSignOut();
    const deviceLocale = applyDeviceLocaleOnMobile();
    if (deviceLocale !== locale) {
      setLocale(deviceLocale);
    }
  }, [locale, setLocale, status]);

  return null;
}
