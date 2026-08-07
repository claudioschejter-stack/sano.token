'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { MailCheck, X } from 'lucide-react';
import { OTPInput } from './OTPInput';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';
import { useTranslation } from '../../i18n/LocaleProvider';

/**
 * Second step of the desktop login: the code that arrived by email.
 *
 * The screen asks for the code to be sent rather than expecting the previous
 * step to have pushed it, so the password login and the OAuth gate — which
 * lands here through the middleware with only a pending token — behave the same.
 */
export function EmailCodeVerificationPage() {
  const t = useTranslation();
  const tv = t.totpVerify;
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get('t') ?? '';
  const callbackUrl = searchParams.get('callbackUrl') ?? '/acceso/callback';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(true);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedSeconds, setLockedSeconds] = useState<number | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const requestCode = useCallback(async () => {
    if (!tempToken) return;
    setSending(true);
    setError(null);

    const res = await fetch('/api/auth/email-code/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken })
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      maskedEmail?: string;
      delivered?: boolean;
      error?: string;
      remainingSeconds?: number;
    };

    setSending(false);

    if (!res.ok || !data.ok) {
      if (data.remainingSeconds) {
        setLockedSeconds(data.remainingSeconds);
        setError(
          tv.accountLockedMinutes.replace('{minutes}', String(Math.ceil(data.remainingSeconds / 60)))
        );
        return;
      }
      setError(tv.emailCodeSendFailed);
      return;
    }

    setMaskedEmail(data.maskedEmail ?? null);
    // Delivery is reported separately: the code exists either way, but if the
    // provider rejected it, saying "check your inbox" would be a lie.
    if (data.delivered === false) {
      setError(tv.emailCodeSendFailed);
    }
    setResendIn(30);
  }, [tempToken, tv]);

  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void requestCode();
  }, [requestCode]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function verify(submitted: string) {
    if (loading) return;
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/email-code/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code: submitted })
    });

    const data = (await res.json().catch(() => ({}))) as {
      loginToken?: string;
      error?: string;
      remainingAttempts?: number;
      remainingSeconds?: number;
    };

    if (!res.ok || !data.loginToken) {
      setLoading(false);
      setCode('');

      if (data.remainingSeconds) {
        setLockedSeconds(data.remainingSeconds);
        setError(
          tv.accountLockedMinutes.replace('{minutes}', String(Math.ceil(data.remainingSeconds / 60)))
        );
        return;
      }

      setRemainingAttempts(data.remainingAttempts ?? null);
      setError(
        data.remainingAttempts != null
          ? tv.wrongCodeAttempts
              .replace('{count}', String(data.remainingAttempts))
              .replace('{plural}', data.remainingAttempts !== 1 ? 's' : '')
          : tv.wrongCodeExpired
      );
      return;
    }

    const result = await signIn('passkey', { loginToken: data.loginToken, redirect: false });
    if (result?.error) {
      setLoading(false);
      setError(tv.sessionCreationError);
      return;
    }

    await waitForAccessToken();
    router.push(callbackUrl);
  }

  if (!tempToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <X className="mx-auto mb-3 text-red-500" size={32} />
          <p className="font-semibold text-red-700">{tv.invalidSessionTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{tv.invalidSessionDesc}</p>
          <a href="/acceso" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
            {tv.goToLogin}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <MailCheck size={28} />
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{tv.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {maskedEmail
                ? tv.emailCodeDesc.replace('{email}', maskedEmail)
                : tv.emailCodeDescGeneric}
            </p>
          </div>

          {lockedSeconds ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              <OTPInput
                value={code}
                onChange={setCode}
                onComplete={(val) => void verify(val)}
                error={Boolean(error)}
                autoFocus
                disabled={loading || sending}
              />

              {error ? (
                <p className="text-center text-sm text-red-600">{error}</p>
              ) : remainingAttempts != null ? (
                <p className="text-center text-xs text-amber-600">
                  {tv.attemptsRemaining
                    .replace('{count}', String(remainingAttempts))
                    .replace(/\{plural\}/g, remainingAttempts !== 1 ? 's' : '')}
                </p>
              ) : null}

              <button
                onClick={() => void verify(code)}
                disabled={loading || sending || code.length < 6}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {loading ? tv.verifying : tv.confirm}
              </button>

              <button
                onClick={() => void requestCode()}
                disabled={sending || resendIn > 0}
                className="w-full text-center text-sm text-slate-500 transition hover:text-slate-800 disabled:opacity-60"
              >
                {resendIn > 0
                  ? tv.emailCodeResendIn.replace('{seconds}', String(resendIn))
                  : tv.emailCodeResend}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
