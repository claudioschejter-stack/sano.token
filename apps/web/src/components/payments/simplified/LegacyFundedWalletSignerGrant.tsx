'use client';

import { useLoginWithEmail, usePrivy, useSigners, useWallets } from '@privy-io/react-auth';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import {
  isLegacySignerGrantActive,
  setLegacySignerGrantActive
} from '../../../lib/privy/legacySignerGrantFlag';

const PRIVY_AUTH_QUORUM_ID = process.env.NEXT_PUBLIC_PRIVY_AUTHORIZATION_KEY_QUORUM_ID?.trim() ?? '';

type Props = {
  fundedAddress: string;
  onGranted?: () => void;
};

/**
 * Shown when Custom Auth session wallet ≠ funded Sanova wallet (legacy email Privy user).
 * Pauses JWT sync, logs into the email Privy identity once, grants the app signer, resumes.
 */
export function LegacyFundedWalletSignerGrant({ fundedAddress, onGranted }: Props) {
  const sc = useTranslation().simplifiedCheckout;
  const { data: session } = useSession();
  const { ready, authenticated, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { addSigners } = useSigners();
  const { sendCode, loginWithCode } = useLoginWithEmail();

  const email = session?.user?.email?.trim() ?? '';
  const target = fundedAddress.trim().toLowerCase();
  const grantAttemptedRef = useRef(false);

  const [active, setActive] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setActive(isLegacySignerGrantActive());
  }, []);

  const ownsFundedWallet = Boolean(
    wallets.some((wallet) => wallet.address.trim().toLowerCase() === target) ||
      user?.linkedAccounts?.some(
        (account) =>
          account.type === 'wallet' &&
          'address' in account &&
          typeof account.address === 'string' &&
          account.address.trim().toLowerCase() === target
      )
  );

  const grantSigner = useCallback(async () => {
    if (!PRIVY_AUTH_QUORUM_ID || !target) {
      throw new Error('PRIVY_AUTH_QUORUM_MISSING');
    }
    await addSigners({
      address: target,
      signers: [{ signerId: PRIVY_AUTH_QUORUM_ID, policyIds: [] }]
    });
    setLegacySignerGrantActive(false);
    setActive(false);
    setDone(true);
    onGranted?.();
    // Resume Custom Auth cleanly after the one-time email session.
    window.setTimeout(() => window.location.reload(), 800);
  }, [addSigners, onGranted, target]);

  useEffect(() => {
    if (!active || !authenticated || !ownsFundedWallet || done || grantAttemptedRef.current) return;
    grantAttemptedRef.current = true;
    let cancelled = false;
    setBusy(true);
    setError(null);
    void grantSigner()
      .catch((err) => {
        if (!cancelled) {
          grantAttemptedRef.current = false;
          setError(err instanceof Error ? err.message : 'SIGNER_GRANT_FAILED');
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, authenticated, done, grantSigner, ownsFundedWallet]);

  const start = useCallback(async () => {
    if (!email || !PRIVY_AUTH_QUORUM_ID) {
      setError(sc.cryptoWalletLegacySignerMissingConfig);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setLegacySignerGrantActive(true);
      setActive(true);
      if (authenticated) {
        await logout();
      }
      await sendCode({ email });
      setCodeSent(true);
    } catch (err) {
      setLegacySignerGrantActive(false);
      setActive(false);
      setError(err instanceof Error ? err.message : 'SEND_CODE_FAILED');
    } finally {
      setBusy(false);
    }
  }, [authenticated, email, logout, sc.cryptoWalletLegacySignerMissingConfig, sendCode]);

  const verify = useCallback(async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithCode({ code: code.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'LOGIN_CODE_FAILED');
      setBusy(false);
    }
  }, [code, loginWithCode]);

  const cancel = useCallback(async () => {
    setLegacySignerGrantActive(false);
    setActive(false);
    setCodeSent(false);
    setCode('');
    setError(null);
    // Resume Custom Auth on next load.
    window.location.reload();
  }, []);

  if (!PRIVY_AUTH_QUORUM_ID) {
    return (
      <p className="text-[11px] leading-relaxed text-amber-500">
        {sc.cryptoWalletLegacySignerMissingConfig}
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-[11px] leading-relaxed text-terminal-success">
        {sc.cryptoWalletLegacySignerGranted}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-900/10 px-3 py-3">
      <p className="text-[11px] font-semibold text-amber-400">{sc.cryptoWalletLegacySignerTitle}</p>
      <p className="text-[11px] leading-relaxed text-terminal-muted">
        {sc.cryptoWalletLegacySignerBody}
      </p>
      <p className="break-all font-mono text-[10px] text-terminal-text">{fundedAddress}</p>

      {!codeSent ? (
        <button
          type="button"
          disabled={busy || !ready || !email}
          onClick={() => void start()}
          className="flex w-full min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {sc.cryptoWalletLegacySignerCta}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-terminal-muted">
            {sc.cryptoWalletLegacySignerCodeHint.replace('{email}', email)}
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-sm text-terminal-text"
          />
          <button
            type="button"
            disabled={busy || code.trim().length < 4}
            onClick={() => void verify()}
            className="flex w-full min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {sc.cryptoWalletLegacySignerVerifyCta}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void cancel()}
            className="w-full text-center text-[11px] font-semibold text-terminal-muted"
          >
            {sc.cryptoWalletLegacySignerCancel}
          </button>
        </div>
      )}

      {error ? <p className="text-[11px] leading-relaxed text-red-500">{error}</p> : null}
    </div>
  );
}
