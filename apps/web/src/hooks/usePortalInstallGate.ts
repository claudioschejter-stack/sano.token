'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDeviceDetection } from './useDeviceDetection';
import { useIsPwa } from './useIsPwa';
import { usePortalGatePreferences } from './usePortalGatePreferences';

const SESSION_SEEN_KEY = 'sanova.pwa.installGate.seenSession';

/**
 * Gates first-time entry to the dashboard for mobile **browser** visitors
 * (not the installed PWA) behind an interstitial recommending the app
 * install, so future users default into the installed app instead of a
 * browser tab. Never re-appears within the same browser session once
 * dismissed, and never again on this device once installed or permanently
 * dismissed (tracked via usePortalGatePreferences — deliberately separate
 * from the legacy desktop InstallAppBanner's usePwaPreferences, so a past
 * interaction with that other surface can't permanently suppress this gate).
 */
export function usePortalInstallGate() {
  const isPwa = useIsPwa();
  const { isMobile } = useDeviceDetection();
  const { dismissed, installed, loaded, setInstalled } = usePortalGatePreferences();
  const [seenThisSession, setSeenThisSession] = useState(true);
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setSeenThisSession(window.sessionStorage.getItem(SESSION_SEEN_KEY) === '1');
    setCheckedSession(true);
  }, []);

  const markSeenThisSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_SEEN_KEY, '1');
    }
    setSeenThisSession(true);
  }, []);

  const shouldGate =
    checkedSession && loaded && isMobile && !isPwa && !dismissed && !installed && !seenThisSession;

  const acceptInstall = useCallback(() => {
    setInstalled(true);
    markSeenThisSession();
  }, [setInstalled, markSeenThisSession]);

  return { shouldGate, markSeenThisSession, acceptInstall };
}
