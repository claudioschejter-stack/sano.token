'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  CheckCircle2,
  Smartphone
} from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { requiresPhoneVerification } from '../../lib/onboarding/phoneVerificationPolicy';
import { defersEmailVerificationToPrivy } from '../../lib/onboarding/emailVerificationPolicy';
import { safeReturnTo } from '../../lib/auth/redirects';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { ActivateWalletStep } from './ActivateWalletStep';
import { PrivyOnboardingWallet } from './PrivyOnboardingWallet';
import { isPrivyEnabled } from '../../lib/privy/config';

import { TotpOnboardingStep } from '../auth/TotpOnboardingStep';
import { requiresInvestorStyleOnboarding } from '../../lib/onboarding/onboardingGate';

type Step = 'email' | 'phone' | 'identity' | 'wallet' | 'totp' | 'done';

const ONBOARDING_STEPS: Step[] = ['email', 'phone', 'identity', 'wallet', 'totp', 'done'];

function stepFromChecklist(
  checklist: ReturnType<typeof useAccountStatus>['checklist'],
  diditReturn: boolean,
  requireWallet: boolean,
  deferEmailToPrivy: boolean,
  systemRole: ReturnType<typeof useAccountStatus>['systemRole']
): Step {
  if (!checklist) {
    return 'email';
  }

  if (!checklist.emailVerified && !deferEmailToPrivy) {
    return 'email';
  }

  if (!checklist.phoneVerified && requiresPhoneVerification(systemRole)) {
    return 'phone';
  }

  if (!checklist.kycEnabled) {
    return 'email';
  }

  if (!checklist.kycApproved || diditReturn) {
    return 'identity';
  }

  if (requireWallet && !checklist.walletLinked) {
    return 'wallet';
  }

  if (
    requiresInvestorStyleOnboarding(systemRole) &&
    checklist.kycApproved &&
    checklist.walletLinked &&
    !checklist.totpEnabled
  ) {
    return 'totp';
  }

  if (checklist.operational) {
    return 'done';
  }

  return 'identity';
}

function OnboardingContent() {
  const router = useRouter();
  const t = useTranslation();
  const o = t.onboarding;
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'), '/marketplace');
  const diditReturn = searchParams.get('didit') === '1';
  const requestedStepParam = searchParams.get('step');
  const totpPreferConfirm = searchParams.get('totpMode') === 'confirm';

  const { data: session, status, update: updateSession } = useSession();
  const { checklist, loading, refresh, isOperational, systemRole } = useAccountStatus();
  const sessionReady = status === 'authenticated' && Boolean(session?.user?.accessToken);
  const requireWallet = Boolean(systemRole);
  const deferEmailToPrivy = defersEmailVerificationToPrivy(systemRole);

  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [diditLaunching, setDiditLaunching] = useState(false);
  const emailCodeSent = useRef(false);
  const phoneCodeSent = useRef(false);
  const [deliveryHint, setDeliveryHint] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const computedStep = useMemo(
    () =>
      stepFromChecklist(
        checklist,
        diditReturn && !checklist?.kycApproved,
        requireWallet,
        deferEmailToPrivy,
        systemRole
      ),
    [checklist, deferEmailToPrivy, diditReturn, requireWallet, systemRole]
  );

  const step = useMemo(() => {
    if (!requestedStepParam || !ONBOARDING_STEPS.includes(requestedStepParam as Step)) {
      return computedStep;
    }

    if (computedStep === 'done' || checklist?.operational) {
      return 'done';
    }

    const requestedStep = requestedStepParam as Step;
    const requestedIndex = ONBOARDING_STEPS.indexOf(requestedStep);
    const computedIndex = ONBOARDING_STEPS.indexOf(computedStep);

    if (requestedStep === computedStep) {
      return requestedStep;
    }

    if (requestedStep === 'totp' && computedStep === 'totp') {
      return 'totp';
    }

    // Allow revisiting an earlier step only (?step=email while already on wallet).
    if (requestedIndex < computedIndex) {
      return requestedStep;
    }

    return computedStep;
  }, [checklist?.operational, computedStep, requestedStepParam]);

  const progressIndex = ONBOARDING_STEPS.indexOf(step);

  const handleTotpComplete = useCallback(async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch('/api/onboarding/status', { cache: 'no-store' });
      if (response.ok) {
        const data = (await response.json()) as {
          checklist?: { totpEnabled?: boolean; operational?: boolean };
        };
        if (data.checklist?.totpEnabled) {
          await refresh({ silent: true });
          if (data.checklist.operational) {
            await updateSession({ accountOperational: true });
          }
          router.replace(returnTo);
          return;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    await refresh({ silent: true });
    await updateSession({ accountOperational: true });
    router.replace(returnTo);
  }, [refresh, returnTo, router, updateSession]);

  useEffect(() => {
    if (!isOperational) {
      return;
    }

    if (requireWallet && !checklist?.walletLinked && step !== 'done') {
      return;
    }

    if (step === 'done' || (isOperational && (!requireWallet || checklist?.walletLinked))) {
      router.replace(returnTo);
    }
  }, [checklist?.walletLinked, isOperational, requireWallet, returnTo, router, step]);

  const syncDiditStatus = useCallback(async () => {
    try {
      await fetch('/api/onboarding/didit/status', {
        method: 'POST',
        credentials: 'same-origin'
      });
      await refresh({ silent: true });
    } catch {
      // The webhook may still arrive asynchronously.
    }
  }, [refresh]);

  useEffect(() => {
    if (diditReturn) {
      void syncDiditStatus();
    }
  }, [diditReturn, syncDiditStatus]);

  useEffect(() => {
    if (checklist?.emailVerified) {
      setDeliveryHint(null);
    }
  }, [checklist?.emailVerified]);

  const requestPhoneVerificationCode = useCallback(async () => {
    setError(null);
    setDevHint(null);

    try {
      const response = await fetch('/api/onboarding/resend-phone-code', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        const errorKey = data.error ?? 'GENERIC';
        setError(o.errors[errorKey as keyof typeof o.errors] ?? o.errors.GENERIC);
        return false;
      }

      setDeliveryHint(o.steps.codeSentPhone);
      return true;
    } catch {
      setError(o.errors.GENERIC);
      return false;
    }
  }, [o.errors, o.steps.codeSentPhone]);

  const requestVerificationCode = useCallback(async () => {
    setError(null);
    setDevHint(null);

    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await fetch('/api/onboarding/resend-code', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = (await response.json()) as {
          error?: string;
          devCode?: string;
        };

        if (response.status === 401 && attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
          continue;
        }

        if (!response.ok) {
          const errorKey = data.error ?? 'GENERIC';
          setError(o.errors[errorKey as keyof typeof o.errors] ?? o.errors.GENERIC);
          return false;
        }

        setDeliveryHint(o.steps.codeSentEmail);

        if (data.devCode) {
          setDevHint(`Email: ${data.devCode}`);
        }

        return true;
      } catch {
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
          continue;
        }

        setError(o.errors.GENERIC);
        return false;
      }
    }

    setError(o.errors.UNAUTHORIZED);
    return false;
  }, [o.errors, o.steps.codeSentEmail]);

  useEffect(() => {
    if (
      !sessionReady ||
      loading ||
      !checklist ||
      step !== 'phone' ||
      checklist.phoneVerified ||
      phoneCodeSent.current
    ) {
      return;
    }

    phoneCodeSent.current = true;
    void requestPhoneVerificationCode().then((ok) => {
      if (!ok) {
        phoneCodeSent.current = false;
      }
    });
  }, [checklist, loading, requestPhoneVerificationCode, sessionReady, step]);

  useEffect(() => {
    if (
      !sessionReady ||
      loading ||
      !checklist ||
      step !== 'email' ||
      checklist.emailVerified ||
      emailCodeSent.current
    ) {
      return;
    }

    emailCodeSent.current = true;
    void requestVerificationCode().then((ok) => {
      if (!ok) {
        emailCodeSent.current = false;
      }
    });
  }, [checklist, loading, requestVerificationCode, sessionReady, step]);

  const resendCurrentCode = useCallback(async () => {
    setResending(true);
    if (step === 'phone') {
      await requestPhoneVerificationCode();
    } else {
      await requestVerificationCode();
    }
    setResending(false);
  }, [requestPhoneVerificationCode, requestVerificationCode, step]);

  const verifyPhone = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/verify-phone', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: phoneCode })
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        const errorKey = data.error ?? 'INVALID_CODE';
        setError(o.errors[errorKey as keyof typeof o.errors] ?? o.errors.INVALID_CODE);
        return;
      }

      await refresh({ silent: true });
    } catch {
      setError(o.errors.GENERIC);
    } finally {
      setBusy(false);
    }
  }, [phoneCode, o.errors, refresh]);

  const verifyEmail = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/verify-email', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: emailCode })
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        const errorKey = data.error ?? 'INVALID_CODE';
        setError(o.errors[errorKey as keyof typeof o.errors] ?? o.errors.INVALID_CODE);
        return;
      }

      await refresh({ silent: true });
    } catch {
      setError(o.errors.GENERIC);
    } finally {
      setBusy(false);
    }
  }, [emailCode, o.errors, refresh]);

  const startDidit = useCallback(async () => {
    setBusy(true);
    setDiditLaunching(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/didit/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo })
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.error === 'DIDIT_NOT_CONFIGURED') {
        setError(o.errors.DIDIT_NOT_CONFIGURED);
        setDiditLaunching(false);
        return;
      }

      if (data.error === 'CONTACT_NOT_VERIFIED') {
        setError(o.errors.CONTACT_NOT_VERIFIED);
        setDiditLaunching(false);
        await refresh({ silent: true });
        return;
      }

      setError(o.errors.GENERIC);
      setDiditLaunching(false);
    } catch {
      setError(o.errors.GENERIC);
      setDiditLaunching(false);
    } finally {
      setBusy(false);
    }
  }, [o.errors, refresh, returnTo]);

  const completeDemoKyc = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/demo-kyc', {
        method: 'POST',
        credentials: 'same-origin'
      });
      if (!response.ok) {
        setError(o.errors.GENERIC);
        return;
      }

      await refresh({ silent: true });
    } catch {
      setError(o.errors.GENERIC);
    } finally {
      setBusy(false);
    }
  }, [o.errors, refresh]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const destination = `/acceso?returnTo=${encodeURIComponent(`/kyc?returnTo=${encodeURIComponent(returnTo)}`)}`;
      router.replace(destination);
    }
  }, [returnTo, router, status]);

  if (status === 'unauthenticated' || status === 'loading' || !sessionReady || (loading && !checklist)) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-white px-4 text-center text-slate-600">
        <p className="text-sm font-medium">{o.loading}</p>
        <Link href="/acceso" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
          {o.backToAccess}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur-md safe-top">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{o.eyebrow}</p>
              <h1 className="text-lg font-bold">{o.title}</h1>
            </div>
          </div>
          <Link href="/acceso" className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-500">
            {o.backToAccess}
          </Link>
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-md gap-1.5">
          {ONBOARDING_STEPS.slice(0, -1).map((stepKey, index) => (
            <div
              key={stepKey}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                progressIndex >= index ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 pb-28">
        {error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {devHint ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {o.devCodes}: {devHint}
          </p>
        ) : null}

        {deliveryHint && !checklist.emailVerified ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {deliveryHint}
          </p>
        ) : null}

        {checklist.emailVerified && step === 'identity' ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-800">{o.steps.emailApproved}</p>
          </div>
        ) : null}

        {step === 'phone' ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">{o.steps.phoneTitle}</h2>
            <p className="text-sm text-slate-600">
              {o.steps.phoneDesc}{' '}
              <span className="font-medium text-slate-800">{checklist.phone}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center text-2xl font-semibold tracking-[0.4em] outline-none ring-blue-500 focus:ring-2"
            />
            <p className="text-center text-xs text-slate-500">{o.steps.codeExpiredHint}</p>
            <button
              type="button"
              disabled={resending || busy}
              onClick={() => void resendCurrentCode()}
              className="mx-auto block text-sm font-semibold text-blue-600 hover:text-blue-500 disabled:opacity-60"
            >
              {resending ? o.steps.resendingCode : o.steps.resendCode}
            </button>
          </section>
        ) : null}

        {step === 'email' ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">{o.steps.emailTitle}</h2>
            <p className="text-sm text-slate-600">
              {(deferEmailToPrivy ? o.steps.emailDescPrivyFallback : o.steps.emailDesc)}{' '}
              <span className="font-medium text-slate-800">{checklist.email}</span>
            </p>
            {deferEmailToPrivy ? (
              <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900">
                {o.steps.emailPrivyWalletNote}
              </p>
            ) : null}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center text-2xl font-semibold tracking-[0.4em] outline-none ring-blue-500 focus:ring-2"
            />
            <p className="text-center text-xs text-slate-500">{o.steps.codeExpiredHint}</p>
            <button
              type="button"
              disabled={resending || busy}
              onClick={() => void resendCurrentCode()}
              className="mx-auto block text-sm font-semibold text-blue-600 hover:text-blue-500 disabled:opacity-60"
            >
              {resending ? o.steps.resendingCode : o.steps.resendCode}
            </button>
          </section>
        ) : null}

        {step === 'identity' ? (
          <section className="space-y-5">
            <h2 className="text-xl font-bold">{o.steps.identityTitle}</h2>

            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-medium text-slate-900">{o.steps.identityDesc}</p>
              <p>{o.steps.identityStep1}</p>
              <p>{o.steps.identityStep2}</p>
              <p className="text-xs leading-relaxed text-slate-500">
                {o.steps.identityPrivacyNotice}{' '}
                <Link href="/privacidad" className="font-semibold text-blue-600 hover:text-blue-500">
                  {t.legal.privacyLink}
                </Link>
              </p>
            </div>

            {checklist?.diditEnabled ? (
              <>
                <button
                  type="button"
                  disabled={diditLaunching || busy}
                  onClick={() => void startDidit()}
                  className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
                >
                  {diditLaunching || busy ? o.steps.diditRedirecting : o.steps.startDidit}
                </button>
                <p className="text-center text-sm text-slate-600">
                  {requireWallet ? o.steps.identityWalletNote : o.steps.identityOperationalNote}
                </p>
              </>
            ) : checklist?.allowDemoKyc ? (
              <button
                type="button"
                disabled={busy || !checklist?.kycEnabled}
                onClick={() => void completeDemoKyc()}
                className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white text-base font-semibold text-slate-900 disabled:opacity-60"
              >
                {o.steps.demoKyc}
              </button>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {o.steps.kycProviderUnavailable}
              </p>
            )}
          </section>
        ) : null}

        {step === 'wallet' ? (
          isPrivyEnabled() ? (
            <PrivyOnboardingWallet
              onLinked={async () => {
                await refresh({ silent: true });
              }}
              onError={setError}
            />
          ) : (
            <ActivateWalletStep
              onLinked={async () => {
                await refresh({ silent: true });
              }}
              onError={setError}
            />
          )
        ) : null}

        {step === 'totp' ? (
          <TotpOnboardingStep preferConfirm={totpPreferConfirm} onComplete={handleTotpComplete} />
        ) : null}

        {step === 'done' ? (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <CheckCircle2 className="text-emerald-500" size={56} />
            <h2 className="mt-4 text-2xl font-bold">{o.steps.doneTitle}</h2>
            <p className="mt-2 text-sm text-slate-600">{o.steps.doneDesc}</p>
          </section>
        ) : null}
      </main>

      {step !== 'done' && step !== 'identity' && step !== 'wallet' && step !== 'totp' ? (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-md safe-bottom">
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              disabled={
                busy ||
                (step === 'phone' && phoneCode.length !== 6) ||
                (step === 'email' && emailCode.length !== 6)
              }
              onClick={() => {
                if (step === 'phone') void verifyPhone();
                else if (step === 'email') void verifyEmail();
              }}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 text-base font-semibold text-white disabled:opacity-60"
            >
              {busy ? o.continuing : o.continue}
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

export function OnboardingView() {
  const t = useTranslation();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-white text-slate-600">
          <p className="text-sm font-medium">{t.onboarding.loading}</p>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
