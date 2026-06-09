'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { detectDeviceLocale } from '../../i18n/detectLocale';
import { useLocale } from '../../i18n/LocaleProvider';
import { isMobileDevice } from '../../lib/mobile/deviceConfig';

/** Keeps mobile locale aligned with the device and persists it for authenticated users. */
export function SessionLocaleSync() {
  const { status } = useSession();
  const { locale, setLocale } = useLocale();

  useEffect(() => {
    if (status !== 'authenticated' || !isMobileDevice()) {
      return;
    }

    const deviceLocale = detectDeviceLocale();
    if (deviceLocale !== locale) {
      setLocale(deviceLocale);
    }
  }, [locale, setLocale, status]);

  return null;
}
