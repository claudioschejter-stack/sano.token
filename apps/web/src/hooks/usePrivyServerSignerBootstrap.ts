'use client';

import { useSigners } from '@privy-io/react-auth';
import { useEffect, useRef } from 'react';
import { isAddSignersAlreadyPresentError } from '../lib/privy/isAddSignersAlreadyPresentError';
import { usePrivyEmbeddedWallet } from './usePrivyEmbeddedWallet';

const QUORUM_ID = process.env.NEXT_PUBLIC_PRIVY_AUTHORIZATION_KEY_QUORUM_ID?.trim() ?? '';

/**
 * One-time: when Privy Custom Auth has a silent session, add the app
 * authorization key as a signer on the investor embedded wallet so cron /
 * server auto-settle can Transfer without a browser login.
 *
 * Asks the server first: Privy answers PATCH 400 when the signer is already
 * present, and even though that is harmless, the browser logs the failed
 * request, so every session showed an error that looked like a bug.
 */
export function usePrivyServerSignerBootstrap() {
  const { authenticated, address } = usePrivyEmbeddedWallet();
  const { addSigners } = useSigners();
  const attemptedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!QUORUM_ID || !authenticated || !address) return;
    if (attemptedFor.current === address.toLowerCase()) return;
    attemptedFor.current = address.toLowerCase();

    void (async () => {
      try {
        const response = await fetch(
          `/api/privy/signer-status?address=${encodeURIComponent(address)}`,
          { credentials: 'same-origin' }
        );
        if (response.ok) {
          const { granted } = (await response.json()) as { granted: boolean | null };
          if (granted === true) return;
        }
      } catch {
        // Undetermined: fall through and attempt the grant.
      }

      try {
        await addSigners({ address, signers: [{ signerId: QUORUM_ID, policyIds: [] }] });
      } catch (error) {
        if (isAddSignersAlreadyPresentError(error)) return;
        console.warn('[usePrivyServerSignerBootstrap] addSigners failed', error);
      }
    })();
  }, [addSigners, address, authenticated]);
}
