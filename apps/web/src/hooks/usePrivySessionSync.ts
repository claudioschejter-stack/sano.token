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
 *        - Prefer JWKS URL: https://sano-token-web.vercel.app/api/auth/privy-jwks
 *          (NOT www.sanovacapital.com — Cloudflare bot-challenge returns 403)
 *        - User ID claim: sub
 *        - Auth environment: Client-side (or Both)
 *   3. Allowed origins must include https://www.sanovacapital.com
 *   4. Set NEXT_PUBLIC_PRIVY_CUSTOM_AUTH=true in Vercel env vars
 *   5. Set PRIVY_JWT_PRIVATE_KEY in Vercel env vars
 *
 * @see https://docs.privy.io/authentication/user-authentication/jwt-based-auth/usage
 */

import { useSubscribeToJwtAuthWithFlag } from '@privy-io/react-auth';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isLegacySignerGrantActive,
  LEGACY_SIGNER_GRANT_EVENT
} from '../lib/privy/legacySignerGrantFlag';

const CUSTOM_AUTH_ENABLED = process.env.NEXT_PUBLIC_PRIVY_CUSTOM_AUTH === 'true';

/** After Privy rejects credentials, pause refetch to avoid 429 + CORS noise. */
const FAILURE_COOLDOWN_MS = 60_000;

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
  const cooldownUntilRef = useRef(0);
  const warnedRef = useRef(false);
  const [legacyGrantActive, setLegacyGrantActive] = useState(false);

  useEffect(() => {
    const sync = () => setLegacyGrantActive(isLegacySignerGrantActive());
    sync();
    window.addEventListener(LEGACY_SIGNER_GRANT_EVENT, sync);
    return () => window.removeEventListener(LEGACY_SIGNER_GRANT_EVENT, sync);
  }, []);

  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  const getExternalJwt = useCallback(async (): Promise<string | undefined> => {
    if (!isAuthenticated || legacyGrantActive) return undefined;

    if (Date.now() < cooldownUntilRef.current) {
      return undefined;
    }

    const token = await fetchPrivyJwt();
    if (!token) {
      cooldownUntilRef.current = Date.now() + FAILURE_COOLDOWN_MS;
      if (!warnedRef.current) {
        warnedRef.current = true;
        console.warn(
          '[usePrivySessionSync] /api/auth/privy-token unavailable — Custom Auth paused 60s. Check PRIVY_JWT_PRIVATE_KEY and session.'
        );
      }
      return undefined;
    }

    return token;
  }, [isAuthenticated, legacyGrantActive]);

  const onError = useCallback((error: Error) => {
    cooldownUntilRef.current = Date.now() + FAILURE_COOLDOWN_MS;
    if (!warnedRef.current) {
      warnedRef.current = true;
      console.warn(
        '[usePrivySessionSync] Privy Custom Auth rejected JWT (invalid_credentials / CORS). ' +
          'In Privy Dashboard use JWKS https://sano-token-web.vercel.app/api/auth/privy-jwks ' +
          'or paste the PEM public key — www.sanovacapital.com/api/auth/privy-jwks is blocked by Cloudflare.',
        error
      );
    }
  }, []);

  useSubscribeToJwtAuthWithFlag({
    isAuthenticated: isAuthenticated && !legacyGrantActive,
    isLoading,
    getExternalJwt,
    enabled: CUSTOM_AUTH_ENABLED && !legacyGrantActive,
    onError
  });
}
