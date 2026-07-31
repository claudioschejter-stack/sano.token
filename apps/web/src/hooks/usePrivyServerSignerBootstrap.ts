'use client';

import { useSigners } from '@privy-io/react-auth';
import { useEffect, useRef } from 'react';
import { usePrivyEmbeddedWallet } from './usePrivyEmbeddedWallet';

const QUORUM_ID = process.env.NEXT_PUBLIC_PRIVY_AUTHORIZATION_KEY_QUORUM_ID?.trim() ?? '';

/**
 * One-time: when Privy Custom Auth has a silent session, add the app
 * authorization key as a signer on the investor embedded wallet so cron /
 * server auto-settle can eth_sendTransaction without a browser login.
 */
export function usePrivyServerSignerBootstrap() {
  const { authenticated, address } = usePrivyEmbeddedWallet();
  const { addSigners } = useSigners();
  const attemptedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!QUORUM_ID || !authenticated || !address) return;
    if (attemptedFor.current === address.toLowerCase()) return;
    attemptedFor.current = address.toLowerCase();

    void addSigners({
      address,
      signers: [{ signerId: QUORUM_ID, policyIds: [] }]
    }).catch((error) => {
      console.warn('[usePrivyServerSignerBootstrap] addSigners failed', error);
    });
  }, [addSigners, address, authenticated]);
}
