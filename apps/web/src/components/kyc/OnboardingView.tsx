'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  CheckCircle2,
  Smartphone
} from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { buildAndValidateE164Phone } from '../../lib/auth/contactValidation';
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_DIAL_CODE,
  parseE164Phone
} from '../../lib/auth/countryDialCodes';
import { defersEmailVerificationToPrivy } from '../../lib/onboarding/emailVerificationPolicy';
import { safeReturnTo } from '../../lib/auth/redirects';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { useMobilePortal } from '../../hooks/useMobilePortal';
import { MOBILE_INVESTOR_HOME_PATH } from '../../lib/auth/mobileDestinations';
import { BiometricOnboardingStep } from '../auth/BiometricOnboardingStep';
import { RegistrationSuccessModal } from '../auth/RegistrationSuccessModal';
import { ActivateWalletStep } from './ActivateWalletStep';
import { PrivyOnboardingWallet } from './PrivyOnboardingWallet';
import { isPrivyEnabled } from '../../lib/privy/config';

import { TotpOnboardingStep } from '../auth/TotpOnboardingStep';
import { requiresInvestorStyleOnboarding } from '../../lib/onboarding/onboardingGate';
import { isMarketplaceTradingRole } from '../../lib/auth/roles';
import { diditErrorI18nKey, parseDiditSessionError } from '../../lib/onboarding/diditService';
import { openDiditVerification } from '../../lib/onboarding/diditSdkClient';

type Step = 'email' | 'identity' | 'wallet' | 'totp' | 'done';

const ONBOARDING_STEPS: Step[] = ['email', 'identity', 'wallet', 'totp', 'done'];

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
  const pathname = usePathname();
  const t = useTranslation();
  const o = t.onboarding;
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'), '/marketplace');
  const diditReturn = searchParams.get('didit') === '1';
  const justRegistered = searchParams.get('registered') === '1';
  const requestedStepParam = searchParams.get('step');
  const totpPreferConfirm = searchParams.get('totpMode') === 'confirm';

  const { data: session, status, update: updateSession } = useSession();
  const { checklist, loading, refresh, isOperational, systemRole, fetchError, profile, registrationChannel, onboardingSuccessShownAt, diditSessionId } =
    useAccountStatus();
  const { isMobile } = useDeviceDetection();
  const isMobilePortal = useMobilePortal();
  const sessionReady = status === 'authenticated' && Boolean(session?.user?.accessToken);
  const requireWallet = Boolean(systemRole);
  const deferEmailToPrivy = defersEmailVerificationToPrivy(systemRole);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [diditLaunching, setDiditLaunching] = useState(false);
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [passkeyReady, setPasskeyReady] = useState(false);

  const needsPhoneCapture = Boolean(
    checklist &&
      isMarketplaceTradingRole((systemRole ?? session?.user?.role) as typeof systemRole) &&
      !checklist.phone?.trim()
  );

  useEffect(() => {
    if (!checklist?.phone) {
      return;
    }

    const parsed = parseE164Phone(checklist.phone);
    if (parsed) {
      setDialCode(parsed.dialCode);
      setPhoneLocal(parsed.local);
    }
  }, [checklist?.phone]);

  // Once the session/checklist have hydrated successfully, later transient
  // `status === 'loading'` flips (triggered by `session.update()` when the
  // JWT catches up to the operational checklist) must not bounce the UI back
  // to the full-page spinner. Doing so caused a visible "done -> spinner ->
  // done -> redirect" flash right before leaving /kyc.
  const hasHydratedRef = useRef(false);
  if (sessionReady && checklist) {
    hasHydratedRef.current = true;
  }

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

  const normalizedRequestedStep = useMemo(() => {
    if (requestedStepParam === 'contact' || requestedStepParam === 'phone') {
      return 'email';
    }
    return requestedStepParam;
  }, [requestedStepParam]);

  const step = useMemo(() => {
    if (!normalizedRequestedStep || !ONBOARDING_STEPS.includes(normalizedRequestedStep as Step)) {
      return computedStep;
    }

    if (computedStep === 'done' || checklist?.operational) {
      return 'done';
    }

    const requestedStep = normalizedRequestedStep as Step;
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
  }, [checklist?.operational, computedStep, normalizedRequestedStep]);

  const progressIndex = ONBOARDING_STEPS.indexOf(step);

  const handleTotpComplete = useCallback(async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch('/api/onboarding/status', { cache: 'no-store' });
      if (response.ok) {
        const data = (await response.json()) as {
          checklist?: { totpEnabled?: boolean; operational?: boolean };
        };
        if (data.checklist?.totpEnabled) {
          await refresh({ silent: true });
          if (data.checklist.operational) {
            await updateSession({});
          }
          // Hard navigation: by the time updateSession() resolves, the browser
          // already applied the refreshed JWT cookie, so a full page load lets
          // the middleware read it immediately instead of racing a soft
          // client-side transition against the cookie write.
          window.location.assign(isMobilePortal ? MOBILE_INVESTOR_HOME_PATH : returnTo);
          return;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    await refresh({ silent: true });
    setError(o.errors.TOTP_ACTIVATION_PENDING);
  }, [isMobilePortal, refresh, returnTo, updateSession, o.errors]);

  useEffect(() => {
    if (!isOperational) {
      return;
    }

    // Guard against redirecting to a protected route before the session cookie
    // (read by the middleware) actually reflects the operational status. Without
    // this, the middleware would immediately bounce the user back to /kyc,
    // producing a redirect loop.
    if (session?.user?.accountOperational !== true) {
      return;
    }

    if (requireWallet && !checklist?.walletLinked && step !== 'done') {
      return;
    }

    if (step === 'done' || (isOperational && (!requireWallet || checklist?.walletLinked))) {
      // Hard navigation avoids racing the middleware against the JWT cookie
      // write from the `update()` call above, which was causing an
      // occasional /kyc <-> returnTo bounce.
      window.location.assign(returnTo);
    }
  }, [
    checklist?.walletLinked,
    isOperational,
    requireWallet,
    returnTo,
    session?.user?.accountOperational,
    step
  ]);

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

  const showDiditProcessing =
    checklist?.kycStatus === 'PENDING' &&
    !checklist?.kycApproved &&
    (Boolean(diditSessionId) || diditReturn);

  useEffect(() => {
    if (!showDiditProcessing) {
      return;
    }

    const interval = window.setInterval(() => {
      void syncDiditStatus();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [showDiditProcessing, syncDiditStatus]);

  useEffect(() => {
    if (!checklist?.phone && profile?.suggestedPhone) {
      const parsed = parseE164Phone(profile.suggestedPhone);
      if (parsed) {
        setDialCode(parsed.dialCode);
        setPhoneLocal(parsed.local);
      }
    }
  }, [checklist?.phone, profile?.suggestedPhone]);

  useEffect(() => {
    if (!sessionReady || loading || isMobile) {
      return;
    }

    if (pathname.startsWith('/kyc/continuar-en-celular')) {
      return;
    }

    router.replace(
      `/kyc/continuar-en-celular?returnTo=${encodeURIComponent(returnTo)}${justRegistered ? '&registered=1' : ''}`
    );
  }, [isMobile, justRegistered, loading, pathname, returnTo, router, sessionReady]);

  useEffect(() => {
    if (!isOperational || onboardingSuccessShownAt) {
      return;
    }

    setShowSuccessModal(true);
  }, [isOperational, onboardingSuccessShownAt]);

  const savePhone = useCallback(async (): Promise<boolean> => {
    setPhoneError(null);
    setSavingPhone(true);

    const phone = buildAndValidateE164Phone(dialCode, phoneLocal);
    if (!phone) {
      setPhoneError(o.errors.INVALID_PHONE);
      setSavingPhone(false);
      return false;
    }

    try {
      const response = await fetch('/api/onboarding/contact', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        const errorKey = data.error ?? 'GENERIC';
        setPhoneError(o.errors[errorKey as keyof typeof o.errors] ?? o.errors.INVALID_PHONE);
        return false;
      }

      await refresh({ silent: true });
      return true;
    } catch {
      setPhoneError(o.errors.GENERIC);
      return false;
    } finally {
      setSavingPhone(false);
    }
  }, [dialCode, o.errors, phoneLocal, refresh]);

  const resolveStepError = useCallback(
    (errorCode?: string) => {
      if (!errorCode) {
        return o.errors.GENERIC;
      }

      if (errorCode === 'CONTACT_NOT_VERIFIED') {
        return o.errors.CONTACT_NOT_VERIFIED;
      }

      if (errorCode === 'UNAUTHORIZED') {
        return o.errors.UNAUTHORIZED;
      }

      const parsed = parseDiditSessionError(errorCode);
      const key = diditErrorI18nKey(parsed) as keyof typeof o.errors;
      return o.errors[key] ?? o.errors.DIDIT_SESSION_FAILED ?? o.errors.GENERIC;
    },
    [o.errors]
  );

  const startDidit = useCallback(async () => {
    if (!checklist?.contactVerified) {
      setError(o.errors.CONTACT_NOT_VERIFIED);
      return;
    }

    if (needsPhoneCapture) {
      const saved = await savePhone();
      if (!saved) {
        setError(o.errors.INVALID_PHONE);
        return;
      }
    }

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
      const raw = await response.text();
      let data: { url?: string; error?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as { url?: string; error?: string }) : {};
      } catch {
        setError(o.errors.DIDIT_SESSION_FAILED ?? o.errors.GENERIC);
        setDiditLaunching(false);
        return;
      }

      if (response.ok && data.url) {
        openDiditVerification(data.url, () => {
          void syncDiditStatus();
        });
        setDiditLaunching(false);
        return;
      }

      setError(resolveStepError(data.error));
      setDiditLaunching(false);
    } catch {
      setError(o.errors.DIDIT_SESSION_FAILED ?? o.errors.GENERIC);
      setDiditLaunching(false);
    } finally {
      setBusy(false);
    }
  }, [checklist?.contactVerified, needsPhoneCapture, o.errors, resolveStepError, returnTo, savePhone, syncDiditStatus]);

  const continueWithKyc = useCallback(async () => {
    if (needsPhoneCapture) {
      const saved = await savePhone();
      if (!saved) {
        return;
      }
    }

    if (isMobilePortal && !passkeyReady) {
      setError(o.steps.biometricRequired);
      return;
    }

    await startDidit();
  }, [isMobilePortal, needsPhoneCapture, passkeyReady, savePhone, startDidit, o.steps.biometricRequired]);

  const completeDemoKyc = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/demo-kyc', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        const key = data.error ?? 'GENERIC';
        const onboardingMessage = o.errors[key as keyof typeof o.errors];
        const apiMessage = t.apiErrors[key as keyof typeof t.apiErrors];
        setError(
          onboardingMessage ??
            (typeof apiMessage === 'string' ? apiMessage : undefined) ??
            o.errors.GENERIC
        );
        return;
      }

      await refresh({ silent: true });
    } catch {
      setError(o.errors.GENERIC);
    } finally {
      setBusy(false);
    }
  }, [o.errors, refresh, t.apiErrors]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const destination = `/acceso?returnTo=${encodeURIComponent(`/kyc?returnTo=${encodeURIComponent(returnTo)}`)}`;
      router.replace(destination);
    }
  }, [returnTo, router, status]);

  const shouldShowLoadingScreen =
    status === 'unauthenticated' ||
    (!hasHydratedRef.current && (status === 'loading' || !sessionReady || (loading && !checklist)));

  if (shouldShowLoadingScreen) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-white px-4 text-center text-slate-600">
        <p className="text-sm font-medium">{o.loading}</p>
        <Link href="/acceso" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
          {o.backToAccess}
        </Link>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-white px-4 text-center text-slate-600">
        <p className="text-sm font-medium">
          {fetchError ? o.statusLoadFailed : o.loading}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          {o.statusRetry}
        </button>
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
              <p className="mt-0.5 text-xs font-medium text-blue-600">
                {o.stepProgressLabel.replace('{current}', String(Math.min(progressIndex + 2, 5)))}
              </p>
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
        <div className="mx-auto mt-2 grid w-full max-w-md grid-cols-4 gap-1 text-[10px] font-medium text-slate-500">
          <span className={progressIndex >= 0 ? 'text-blue-700' : ''}>{o.stepLabels.contact}</span>
          <span className={progressIndex >= 1 ? 'text-blue-700' : ''}>{o.stepLabels.identity}</span>
          <span className={progressIndex >= 2 ? 'text-blue-700' : ''}>{o.stepLabels.wallet}</span>
          <span className={progressIndex >= 3 ? 'text-blue-700' : ''}>{o.stepLabels.security}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 pb-28">
        <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {o.introBanner}
        </p>

        {justRegistered ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {o.accountCreatedBanner}
          </p>
        ) : null}

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

        {step === 'email' ? (
          <section className="space-y-4">
            {!checklist.emailVerified ? (
              <>
                <h2 className="text-xl font-bold">{t.access.activation.pendingTitle}</h2>
                <p className="text-sm text-slate-600">{t.access.activation.pendingDesc}</p>
                <p className="text-sm font-semibold text-slate-900">{checklist.email}</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">{o.steps.contactTitle}</h2>
                <p className="text-sm text-slate-600">{o.steps.contactDesc}</p>
                <div>
                  <label htmlFor="onboarding-dial" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {o.fields.countryLabel}
                  </label>
                  <select
                    id="onboarding-dial"
                    value={dialCode}
                    onChange={(event) => setDialCode(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-blue-500 focus:ring-2"
                  >
                    {COUNTRY_DIAL_CODES.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.label} ({entry.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="onboarding-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {o.fields.phone}
                  </label>
                  <input
                    id="onboarding-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={phoneLocal}
                    onChange={(event) => setPhoneLocal(event.target.value.replace(/\D/g, ''))}
                    placeholder={o.fields.phonePlaceholder}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-blue-500 focus:ring-2"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">{o.fields.phoneHint}</p>
                </div>
                {phoneError ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {phoneError}
                  </p>
                ) : null}
                {isMobilePortal ? (
                  <BiometricOnboardingStep
                    onComplete={async (passkeyRegistered) => {
                      if (passkeyRegistered) {
                        setPasskeyReady(true);
                      }
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  disabled={savingPhone || busy || diditLaunching}
                  onClick={() => void continueWithKyc()}
                  className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
                >
                  {busy || diditLaunching ? o.continuing : o.continueWithKyc}
                </button>
              </>
            )}
          </section>
        ) : null}

        {step === 'identity' ? (
          <section className="space-y-5">
            <h2 className="text-xl font-bold">{o.steps.identityTitle}</h2>

            {checklist.kycStatus === 'REJECTED' ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {t.accountStatus.stepKycRejected}
              </p>
            ) : null}

            {showDiditProcessing ? (
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                {diditReturn ? o.steps.diditProcessing : o.steps.kycPendingReview}
              </p>
            ) : null}

            {!showDiditProcessing ? (
              <>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>{o.steps.identityStep1}</li>
              <li>{o.steps.identityStep2}</li>
            </ul>
            <p className="text-xs leading-relaxed text-slate-500">
              {o.steps.identityPrivacyNotice}{' '}
              <Link href="/privacidad" className="font-semibold text-blue-600 hover:text-blue-500">
                {t.legal.privacyLink}
              </Link>
            </p>
              </>
            ) : null}

            {checklist?.diditEnabled && !showDiditProcessing ? (
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
            ) : checklist?.allowDemoKyc && systemRole === 'INVESTOR' ? (
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
              kycApproved={Boolean(checklist?.kycApproved)}
              refresh={refresh}
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
          <TotpOnboardingStep
            preferConfirm={totpPreferConfirm}
            mobileSilent={isMobilePortal}
            onComplete={handleTotpComplete}
          />
        ) : null}

        {step === 'done' ? (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <CheckCircle2 className="text-emerald-500" size={56} />
            <h2 className="mt-4 text-2xl font-bold">{o.steps.doneTitle}</h2>
            <p className="mt-2 text-sm text-slate-600">{o.steps.doneDesc}</p>
          </section>
        ) : null}
      </main>

      <RegistrationSuccessModal
        visible={showSuccessModal}
        onDismiss={() => {
          setShowSuccessModal(false);
          void refresh({ silent: true });
        }}
      />
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
