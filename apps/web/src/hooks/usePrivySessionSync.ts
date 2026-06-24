'use client';

/**
 * Silently syncs the NextAuth session → Privy authentication.
 *
 * Once enabled (NEXT_PUBLIC_PRIVY_CUSTOM_AUTH=true AND Privy Dashboard configured),
 * the user's login to the platform automatically logs them into Privy without any modal.
 *
 * Requirements before enabling:
 *   1. Request "Custom Auth Support" in Privy Dashboard → Integrations → Plugins
 *   2. After approval, configure in Privy Dashboard → User Management → Authentication:
 *        - JWKS URL: https://sanovacapital.com/api/auth/privy-jwks
 *        - User ID claim: sub
 *   3. Set NEXT_PUBLIC_PRIVY_CUSTOM_AUTH=true in Vercel env vars
 *   4. Set PRIVY_JWT_PRIVATE_KEY in Vercel env vars (already done)
 *
 * @see https://docs.privy.io/authentication/user-authentication/jwt-based-auth/usage
 */

import { useSubscribeToJwtAuthWithFlag } from '@privy-io/react-auth';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

const CUSTOM_AUTH_ENABLED = process.env.NEXT_PUBLIC_PRIVY_CUSTOM_AUTH === 'true';

/** Fetches a short-lived RS256 JWT signed by our server for the current user. */
async function fetchPrivyJwt(): Promise<string | undefined> {
  try {
    const res = await fetch('/api/auth/privy-token', {
      credentials: 'same-origin',
      cache: 'no-store'
    });

    if (!res.ok) return undefined;
    const data = (await res.json()) as { token?: string };
    return data.token;
  } catch {
    return undefined;
  }
}

export function usePrivySessionSync() {
  const { status } = useSession();

  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  const getExternalJwt = useCallback(async (): Promise<string | undefined> => {
    if (!isAuthenticated) return undefined;
    return fetchPrivyJwt();
  }, [isAuthenticated]);

  useSubscribeToJwtAuthWithFlag({
    isAuthenticated,
    isLoading,
    getExternalJwt,
    enabled: CUSTOM_AUTH_ENABLED
  });
}
