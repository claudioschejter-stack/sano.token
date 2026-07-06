'use client';

import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { normalizeEmail } from '../../lib/auth/contactValidation';
import { useIsPwa } from '../../hooks/useIsPwa';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import type { OnboardingProfile } from '../../lib/onboarding/profile';
import { buildKycUrl } from '../../lib/auth/kycPaths';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';
import { useTurnstile } from '../../lib/security/useTurnstile';
import { formFieldClassName, formFieldErrorClassName } from '../../lib/ui/formFieldClassName';
import { PasswordInput } from './PasswordInput';
import { VerificationStatusBadge } from './VerificationStatusBadge';

type RegisterFormProps = {
  /** When set, shows contact fields as read-only with onboarding data. */
  profile?: OnboardingProfile | null;
  returnTo?: string;
  initialEmail?: string;
  inviteCode?: string;
  loginHref?: string;
  acceptedLegal?: boolean;
  onAcceptedLegalChange?: (accepted: boolean) => void;
  hideTermsCheckbox?: boolean;
  hidePhaseLabel?: boolean;
};

type FieldErrors = {
  email?: string;
};

export function RegisterForm({
  profile: profileProp,
  returnTo,
  initialEmail = '',
  inviteCode = '',
  loginHref,
  acceptedLegal: controlledAcceptedLegal,
  onAcceptedLegalChange,
  hideTermsCheckbox = false,
  hidePhaseLabel = false
}: RegisterFormProps) {
  const t = useTranslation();
  const r = t.access.register;
  const router = useRouter();
  const { data: session, status } = useSession();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedLegalInternal, setAcceptedLegalInternal] = useState(false);
  const acceptedLegal = controlledAcceptedLegal ?? acceptedLegalInternal;
  const setAcceptedLegal = onAcceptedLegalChange ?? setAcceptedLegalInternal;
  const [registrationErrorCode, setRegistrationErrorCode] = useState<string | null>(null);
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const turnstile = useTurnstile();
  const isPwa = useIsPwa();
  const { isMobile } = useDeviceDetection();
  const channel = isPwa ? 'pwa' : isMobile ? 'mobile-web' : 'desktop-web';
  const readOnly = Boolean(profileProp);

  const emailRef = useRef(email);
  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  useEffect(() => {
    if (readOnly || !initialEmail.trim()) {
      return;
    }

    void checkEmailAvailability(initialEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail, readOnly]);

  const precheckBlocksSubmit =
    emailAlreadyRegistered ||
    registrationErrorCode === 'INVESTOR_ACCESS_NOT_ENABLED' ||
    registrationErrorCode === 'OAUTH_ONLY_DISABLED' ||
    registrationErrorCode === 'REGION_NOT_AVAILABLE' ||
    registrationErrorCode === 'EMAIL_CHECK_FAILED';

  function applyProfile(profile: OnboardingProfile) {
    setEmail(profile.email);
    setEmailVerified(profile.emailVerified);
  }

  useEffect(() => {
    if (profileProp) {
      applyProfile(profileProp);
      return;
    }

    if (status !== 'authenticated' || !session?.user?.accessToken) {
      return;
    }

    let cancelled = false;

    void fetch('/api/onboarding/status', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok || cancelled) {
          return;
        }

        const data = (await response.json()) as { profile?: OnboardingProfile };
        if (data.profile && !cancelled) {
          applyProfile(data.profile);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [profileProp, session?.user?.accessToken, status]);

  function validateEmailField(): string | null {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setFieldErrors({ email: r.errors.INVALID_EMAIL });
      return null;
    }

    setFieldErrors({});
    return normalizedEmail;
  }

  async function checkEmailAvailability(rawEmail: string): Promise<boolean> {
    const normalized = normalizeEmail(rawEmail);
    if (!normalized || readOnly) {
      return true;
    }

    setCheckingEmail(true);
    try {
      const response = await fetch('/api/auth/register/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, channel })
      });
      const data = (await response.json()) as { available?: boolean; reason?: string };

      if (normalizeEmail(emailRef.current) !== normalized) {
        return true;
      }

      if (response.status === 403) {
        setRegistrationErrorCode('REGION_NOT_AVAILABLE');
        setError(r.errors.REGION_NOT_AVAILABLE);
        return false;
      }

      if (response.ok && data.available === false && data.reason === 'EMAIL_IN_USE') {
        setEmailAlreadyRegistered(true);
        setRegistrationErrorCode('EMAIL_IN_USE');
        setError(null);
        return false;
      }

      if (response.ok && data.available === false && data.reason === 'INVESTOR_ACCESS_NOT_ENABLED') {
        setEmailAlreadyRegistered(false);
        setRegistrationErrorCode('INVESTOR_ACCESS_NOT_ENABLED');
        setError(r.errors.INVESTOR_ACCESS_NOT_ENABLED ?? r.errors.GENERIC);
        return false;
      }

      if (response.ok && data.available === false && data.reason === 'OAUTH_ONLY_DISABLED') {
        setEmailAlreadyRegistered(false);
        setRegistrationErrorCode('OAUTH_ONLY_DISABLED');
        setError(r.errors.OAUTH_ONLY_DISABLED ?? r.errors.INVESTOR_ACCESS_NOT_ENABLED ?? r.errors.GENERIC);
        return false;
      }

      setEmailAlreadyRegistered(false);
      setRegistrationErrorCode(null);
      setError(null);
      return true;
    } catch {
      if (normalizeEmail(emailRef.current) !== normalized) {
        return true;
      }

      setRegistrationErrorCode('EMAIL_CHECK_FAILED');
      setError(r.errors.EMAIL_CHECK_FAILED ?? r.errors.GENERIC);
      return false;
    } finally {
      if (normalizeEmail(emailRef.current) === normalized) {
        setCheckingEmail(false);
      }
    }
  }

  function renderExistingAccountActions() {
    return (
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
        <Link href={loginHref ?? '/acceso'} className="text-blue-700 hover:text-blue-600">
          {r.signInLink}
        </Link>
        <Link href="/acceso/olvidar" className="text-blue-700 hover:text-blue-600">
          {r.forgotPasswordLink}
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (readOnly) {
      return;
    }

    setError(null);
    setRegistrationErrorCode(null);

    if (!acceptedLegal) {
      setError(r.termsAcceptRequired);
      return;
    }

    const normalizedEmail = validateEmailField();
    if (!normalizedEmail) {
      return;
    }

    const emailAvailable = await checkEmailAvailability(normalizedEmail);
    if (!emailAvailable) {
      return;
    }

    setLoading(true);

    if (turnstile.enabled && !turnstile.token) {
      setLoading(false);
      setError(r.errors.CAPTCHA_REQUIRED ?? r.errors.GENERIC);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          termsAccepted: true,
          inviteCode: inviteCode.trim() || undefined,
          turnstileToken: turnstile.token,
          channel
        })
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        const key = data.error ?? 'GENERIC';
        setRegistrationErrorCode(key);
        turnstile.reset();

        if (key === 'EMAIL_IN_USE') {
          setEmailAlreadyRegistered(true);
          setLoading(false);
          return;
        }

        const message = r.errors[key as keyof typeof r.errors] ?? r.errors.GENERIC;
        if (key === 'INVALID_EMAIL') {
          setFieldErrors({ email: message });
        } else {
          setError(message);
        }
        setLoading(false);
        return;
      }

      const signInResult = await signIn('credentials', {
        email: normalizedEmail,
        password,
        redirect: false
      });

      if (signInResult?.error) {
        setRegistrationErrorCode('SIGN_IN_FAILED');
        setError(r.errors.SIGN_IN_FAILED);
        setLoading(false);
        return;
      }

      const sessionReady = await waitForAccessToken();
      if (!sessionReady) {
        setRegistrationErrorCode('SIGN_IN_FAILED');
        setError(r.errors.SIGN_IN_FAILED);
        setLoading(false);
        return;
      }

      router.refresh();
      router.push(buildKycUrl(returnTo, undefined, undefined, { registered: true }));
    } catch {
      setError(r.errors.GENERIC);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {!readOnly && !hidePhaseLabel ? (
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
          {r.phaseLabel}
        </p>
      ) : null}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="register-email" className="text-sm font-medium text-slate-700">
            {r.emailLabel}
          </label>
          <VerificationStatusBadge
            verified={emailVerified}
            verifiedLabel={r.verifiedLabel}
            pendingLabel={r.pendingLabel}
          />
        </div>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          readOnly={readOnly || emailVerified}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailAlreadyRegistered(false);
            setRegistrationErrorCode(null);
            setError(null);
            if (fieldErrors.email) {
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }
          }}
          onBlur={() => {
            if (!readOnly && email.trim() && !normalizeEmail(email)) {
              setFieldErrors((current) => ({ ...current, email: r.errors.INVALID_EMAIL }));
              return;
            }
            if (!readOnly && email.trim()) {
              void checkEmailAvailability(email);
            }
          }}
          aria-invalid={Boolean(fieldErrors.email)}
          className={`${formFieldClassName} ${fieldErrors.email ? formFieldErrorClassName : ''}`}
          placeholder={r.emailPlaceholder}
        />
        {fieldErrors.email ? (
          <p className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>
        ) : null}
        {checkingEmail ? (
          <p className="mt-1.5 text-xs text-slate-500">{r.checkingEmail}</p>
        ) : null}
        {emailAlreadyRegistered ? (
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <p>{r.emailAlreadyRegisteredHint}</p>
            {renderExistingAccountActions()}
          </div>
        ) : null}
      </div>

      {!readOnly ? (
        <>
          <PasswordInput
            id="register-password"
            name="password"
            label={r.passwordLabel}
            placeholder={r.passwordPlaceholder}
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            minLength={8}
          />
          <p className="-mt-2 text-xs text-slate-500">{r.passwordHint}</p>
        </>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {registrationErrorCode === 'EMAIL_IN_USE' ? renderExistingAccountActions() : null}
          {registrationErrorCode === 'SIGN_IN_FAILED' ? (
            <p className="mt-2">
              <Link
                href={loginHref ?? '/acceso'}
                className="font-semibold text-blue-700 hover:text-blue-600"
              >
                {r.signInAfterRegisterLink}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {!readOnly && !hideTermsCheckbox ? (
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs leading-relaxed text-slate-600">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(event) => {
              setAcceptedLegal(event.target.checked);
              if (error === r.termsAcceptRequired) {
                setError(null);
              }
            }}
            className="mt-0.5 size-4 shrink-0 rounded border-slate-300"
          />
          <span>
            {r.termsAcceptLabel}{' '}
            <Link href="/terminos" className="font-semibold text-blue-600 hover:text-blue-500">
              {r.termsLinkLabel}
            </Link>
            {' · '}
            <Link href="/privacidad" className="font-semibold text-blue-600 hover:text-blue-500">
              {r.privacyLinkLabel}
            </Link>
          </span>
        </label>
      ) : null}

      {!readOnly ? (
        <>
          {turnstile.widget}
          <button
            type="submit"
            disabled={loading || !acceptedLegal || precheckBlocksSubmit}
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? r.submitting : r.submitButton}
          </button>
        </>
      ) : null}

      {!readOnly && loginHref ? (
        <p>
          <Link
            href={loginHref}
            className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
          >
            {t.access.alreadyRegistered}
          </Link>
        </p>
      ) : null}

      <p className="text-center text-xs text-slate-500">{readOnly ? r.profileHint : r.flowHint}</p>
    </form>
  );
}
