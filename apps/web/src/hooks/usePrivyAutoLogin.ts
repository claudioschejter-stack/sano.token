'use client';

/**
 * Detects when the user is authenticated with NextAuth but not yet with Privy.
 * Exposes a triggerLogin() to launch Privy's OTP flow at a controlled moment
 * (e.g. from a banner on the dashboard), instead of mid-payment.
 *
 * Once the user completes the Privy OTP once, Privy persists the session in the
 * browser indefinitely — subsequent payments won't show any modal.
 */

import { usePrivy } from '@privy-io/react-auth';
import { useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';
import { isPrivyEnabled } from '../lib/privy/config';

export function usePrivyAutoLogin() {
  const { ready, authenticated, login } = usePrivy();
  const { status } = useSession();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const nextAuthAuthenticated = status === 'authenticated';

  /**
   * Show the banner only when:
   * - Privy is configured in this environment
   * - Privy SDK has finished initialising (ready)
   * - User is logged into NextAuth but NOT yet into Privy
   */
  const shouldPrompt = isPrivyEnabled() && ready && !authenticated && nextAuthAuthenticated;

  const triggerLogin = useCallback(async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await login();
    } finally {
      setIsLoggingIn(false);
    }
  }, [isLoggingIn, login]);

  return { shouldPrompt, triggerLogin, isLoggingIn, authenticated };
}
