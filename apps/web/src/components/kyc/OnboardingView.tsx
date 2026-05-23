'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { buildAndValidateE164Phone } from '../../lib/auth/contactValidation';
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_DIAL_CODE,
  parseE164Phone
} from '../../lib/auth/countryDialCodes';
import { safeReturnTo } from '../../lib/auth/redirects';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { InstallAppBanner } from '../pwa/InstallAppBanner';

type Step = 'contact' | 'email' | 'phone' | 'identity' | 'done';

function stepFromChecklist(
  checklist: ReturnType<typeof useAccountStatus>['checklist'],
  diditReturn: boolean
): Step {
  if (!checklist) {
    return 'contact';
  }

  if (checklist.operational) {
    return 'done';
  }

  if (!checklist.phone) {
    return 'contact';
  }

  if (!checklist.emailVerified) {
    return 'email';
  }

  if (!checklist.phoneVerified) {
    return 'phone';
  }

  if (!checklist.kycEnabled) {
    return 'phone';
  }

  if (!checklist.kycApproved || diditReturn) {
    return 'identity';
  }

  return 'done';
}

function OnboardingContent() {
  const router = useRouter();
  const t = useTranslation();
  const o = t.onboarding;
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'), '/marketplace');
  const diditReturn = searchParams.get('didit') === '1';

  const { data: session, status } = useSession();
  const { checklist, loading, refresh, isOperational } = useAccountStatus();

  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [diditLaunching, setDiditLaunching] = useState(false);
  const diditAutoStarted = useRef(false);

  const step = useMemo(
    () => stepFromChecklist(checklist, diditReturn && !checklist?.kycApproved),
    [checklist, diditReturn]
  );

  const progressIndex = ['contact', 'email', 'phone', 'identity', 'done'].indexOf(step);

  useEffect(() => {
    if (!checklist?.phone || phoneLocal) {
      return;
    }

    const parsed = parseE164Phone(checklist.phone);
    if (parsed) {
      setDialCode(parsed.dialCode);
      setPhoneLocal(parsed.local);
    }
  }, [checklist?.phone, phoneLocal]);

  const validatedPhone = useMemo(
    () => buildAndValidateE164Phone(dialCode, phoneLocal),
    [dialCode, phoneLocal]
  );

  useEffect(() => {
    if (isOperational) {
      router.replace(returnTo);
    }
  }, [isOperational, returnTo, router]);

  useEffect(() => {
    if (diditReturn) {
      void refresh();
    }
  }, [diditReturn, refresh]);

  const submitContact = useCallback(async () => {
    const phone = buildAndValidateE164Phone(dialCode, phoneLocal);
    if (!phone) {
      setError(o.errors.INVALID_PHONE);
      return;
    }

    setBusy(true);
    setError(null);
    setDevHint(null);

    try {
      const response = await fetch('/api/onboarding/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = (await response.json()) as {
        error?: string;
        devCodes?: { email?: string; phone?: string };
      };

      if (!response.ok) {
        setError(o.errors[data.error ?? 'GENERIC'] ?? o.errors.GENERIC);
        return;
      }

      if (data.devCodes) {
        const parts = [];
        if (data.devCodes.email) parts.push(`Email: ${data.devCodes.email}`);
        if (data.devCodes.phone) parts.push(`SMS: ${data.devCodes.phone}`);
        setDevHint(parts.join(' · '));
      }

      await refresh();
    } catch {
      setError(o.errors.GENERIC);
    } finally {
      setBusy(false);
    }
  }, [dialCode, o.errors, phoneLocal, refresh]);

  const verifyEmail = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: emailCode })
      });

      if (!response.ok) {
        setError(o.errors.INVALID_CODE);
        return;
      }

      await refresh();
    } catch {
      setError(o.errors.GENERIC);
    } finally {
      setBusy(false);
    }
  }, [emailCode, o.errors, refresh]);

  const verifyPhone = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: phoneCode })
      });

      if (!response.ok) {
        setError(o.errors.INVALID_CODE);
        return;
      }

      await refresh();
    } catch {
      setError(o.errors.GENERIC);
    } finally {
      setBusy(false);
    }
  }, [o.errors, phoneCode, refresh]);

  const startDidit = useCallback(async () => {
    setBusy(true);
    setDiditLaunching(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/didit/session', {
        method: 'POST',
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
        await refresh();
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
  }, [o.errors, returnTo]);

  useEffect(() => {
    if (step !== 'identity' || !checklist?.kycEnabled || !checklist?.diditEnabled || diditAutoStarted.current) {
      return;
    }

    diditAutoStarted.current = true;
    void startDidit();
  }, [checklist?.diditEnabled, checklist?.kycEnabled, startDidit, step]);

  const completeDemoKyc = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/demo-kyc', { method: 'POST' });
      if (!response.ok) {
        setError(o.errors.GENERIC);
        return;
      }

      await refresh();
    } catch {
      setError(o.errors.GENERIC);
    } finally {
      setBusy(false);
    }
  }, [o.errors, refresh]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/acceso');
    }
  }, [router, status]);

  if (status === 'unauthenticated' || status === 'loading' || loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center text-slate-600">
        <p className="text-sm font-medium">{o.loading}</p>
        <Link href="/acceso" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
          {o.backToAccess}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 text-slate-900">
      <InstallAppBanner />

      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 px-4 py-4 backdrop-blur-md safe-top">
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
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
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

        {step === 'contact' ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">{o.steps.contactTitle}</h2>
            <p className="text-sm text-slate-600">{o.steps.contactDesc}</p>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Mail size={16} /> {o.fields.email}
              </span>
              <input
                readOnly
                value={session?.user?.email ?? checklist?.email ?? ''}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Phone size={16} /> {o.fields.phone}
              </span>
              <div className="flex gap-2">
                <select
                  aria-label={o.fields.countryLabel}
                  value={dialCode}
                  onChange={(event) => setDialCode(event.target.value)}
                  className="min-h-14 w-[7.5rem] shrink-0 rounded-2xl border border-slate-200 bg-white px-2 py-4 text-base outline-none ring-blue-500 focus:ring-2"
                >
                  {COUNTRY_DIAL_CODES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.iso} {country.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder={o.fields.phonePlaceholder}
                  value={phoneLocal}
                  onChange={(event) => setPhoneLocal(event.target.value.replace(/\D/g, ''))}
                  className="min-h-14 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base outline-none ring-blue-500 focus:ring-2"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">{o.fields.phoneHint}</p>
            </label>
          </section>
        ) : null}

        {step === 'email' ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">{o.steps.emailTitle}</h2>
            <p className="text-sm text-slate-600">{o.steps.emailDesc}</p>
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
          </section>
        ) : null}

        {step === 'phone' ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">{o.steps.phoneTitle}</h2>
            <p className="text-sm text-slate-600">{o.steps.phoneDesc}</p>
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
          </section>
        ) : null}

        {step === 'identity' ? (
          <section className="space-y-5">
            <h2 className="text-xl font-bold">{o.steps.identityTitle}</h2>
            <p className="text-sm text-slate-600">{o.steps.identityDesc}</p>

            <ul className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                {o.steps.identityDoc}
              </li>
              <li className="flex items-start gap-3">
                <Camera className="mt-0.5 shrink-0 text-blue-600" size={18} />
                {o.steps.identityLiveness}
              </li>
            </ul>

            {checklist?.diditEnabled ? (
              <div className="flex min-h-14 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-blue-900">
                  {diditLaunching || busy ? o.steps.diditRedirecting : o.steps.startDidit}
                </p>
                <p className="text-xs text-blue-700">{o.steps.diditRedirectingHint}</p>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || !checklist?.kycEnabled}
                onClick={() => void completeDemoKyc()}
                className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white text-base font-semibold text-slate-900 disabled:opacity-60"
              >
                {o.steps.demoKyc}
              </button>
            )}

            <p className="text-center text-xs text-slate-500">{o.steps.diditPartner}</p>
          </section>
        ) : null}

        {step === 'done' ? (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <CheckCircle2 className="text-emerald-500" size={56} />
            <h2 className="mt-4 text-2xl font-bold">{o.steps.doneTitle}</h2>
            <p className="mt-2 text-sm text-slate-600">{o.steps.doneDesc}</p>
          </section>
        ) : null}
      </main>

      {step !== 'done' && step !== 'identity' ? (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-md safe-bottom">
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              disabled={busy || (step === 'contact' && !validatedPhone) || (step === 'email' && emailCode.length !== 6) || (step === 'phone' && phoneCode.length !== 6)}
              onClick={() => {
                if (step === 'contact') void submitContact();
                else if (step === 'email') void verifyEmail();
                else if (step === 'phone') void verifyPhone();
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
        <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 text-slate-600">
          <p className="text-sm font-medium">{t.onboarding.loading}</p>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
