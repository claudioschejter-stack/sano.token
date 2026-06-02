'use client';

import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { buildAndValidateE164Phone, normalizeEmail } from '../../lib/auth/contactValidation';
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_DIAL_CODE,
  parseE164Phone
} from '../../lib/auth/countryDialCodes';
import type { OnboardingProfile } from '../../lib/onboarding/profile';
import { buildKycUrl } from '../../lib/auth/kycPaths';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';
import { PasswordInput } from './PasswordInput';
import { VerificationStatusBadge } from './VerificationStatusBadge';

type RegisterFormProps = {
  /** When set, shows contact fields as read-only with onboarding data. */
  profile?: OnboardingProfile | null;
  returnTo?: string;
  initialEmail?: string;
  inviteCode?: string;
};

type FieldErrors = {
  email?: string;
  phone?: string;
};

export function RegisterForm({ profile: profileProp, returnTo, initialEmail = '', inviteCode = '' }: RegisterFormProps) {
  const t = useTranslation();
  const r = t.access.register;
  const router = useRouter();
  const { data: session, status } = useSession();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const readOnly = Boolean(profileProp);

  function applyProfile(profile: OnboardingProfile) {
    setEmail(profile.email);
    setEmailVerified(profile.emailVerified);
    setPhoneVerified(profile.phoneVerified);

    const parsed = parseE164Phone(profile.phone);
    if (parsed) {
      setDialCode(parsed.dialCode);
      setPhoneLocal(parsed.local);
    }
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

  function validateContactFields(): { email: string; phone: string } | null {
    const nextErrors: FieldErrors = {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      nextErrors.email = r.errors.INVALID_EMAIL;
    }

    const phone = buildAndValidateE164Phone(dialCode, phoneLocal);
    if (!phone) {
      nextErrors.phone = r.errors.INVALID_PHONE;
    }

    setFieldErrors(nextErrors);

    if (!normalizedEmail || !phone) {
      return null;
    }

    return { email: normalizedEmail, phone };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (readOnly) {
      return;
    }

    setError(null);

    if (!acceptedLegal) {
      setError(r.termsAcceptRequired);
      return;
    }

    const contact = validateContactFields();
    if (!contact) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contact.email,
          password,
          phone: contact.phone,
          termsAccepted: true,
          inviteCode: inviteCode.trim() || undefined
        })
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        const key = data.error ?? 'GENERIC';
        const message = r.errors[key as keyof typeof r.errors] ?? r.errors.GENERIC;
        if (key === 'INVALID_EMAIL') {
          setFieldErrors({ email: message });
        } else if (key === 'INVALID_PHONE') {
          setFieldErrors({ phone: message });
        } else {
          setError(message);
        }
        setLoading(false);
        return;
      }

      const signInResult = await signIn('credentials', {
        email: contact.email,
        password,
        redirect: false
      });

      if (signInResult?.error) {
        setError(r.errors.SIGN_IN_FAILED);
        setLoading(false);
        return;
      }

      const sessionReady = await waitForAccessToken();
      if (!sessionReady) {
        setError(r.errors.SIGN_IN_FAILED);
        setLoading(false);
        return;
      }

      router.refresh();
      router.push(buildKycUrl(returnTo));
    } catch {
      setError(r.errors.GENERIC);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
            if (fieldErrors.email) {
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }
          }}
          onBlur={() => {
            if (!readOnly && email.trim() && !normalizeEmail(email)) {
              setFieldErrors((current) => ({ ...current, email: r.errors.INVALID_EMAIL }));
            }
          }}
          aria-invalid={Boolean(fieldErrors.email)}
          className={`min-h-12 w-full rounded-lg border px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 read-only:bg-slate-50 read-only:text-slate-600 ${
            fieldErrors.email
              ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
          }`}
          placeholder={r.emailPlaceholder}
        />
        {fieldErrors.email ? (
          <p className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>
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

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="register-phone" className="text-sm font-medium text-slate-700">
            {r.phoneLabel}
          </label>
          <VerificationStatusBadge
            verified={phoneVerified}
            verifiedLabel={r.verifiedLabel}
            pendingLabel={r.pendingLabel}
          />
        </div>
        <div className="flex gap-2">
          <select
            id="register-dial"
            aria-label={r.countryLabel}
            value={dialCode}
            disabled={readOnly || phoneVerified}
            onChange={(event) => setDialCode(event.target.value)}
            className="min-h-12 w-[8.5rem] shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600"
          >
            {COUNTRY_DIAL_CODES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.iso} {country.code}
              </option>
            ))}
          </select>
          <input
            id="register-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required
            readOnly={readOnly || phoneVerified}
            value={phoneLocal}
            onChange={(event) => {
              setPhoneLocal(event.target.value.replace(/\D/g, ''));
              if (fieldErrors.phone) {
                setFieldErrors((current) => ({ ...current, phone: undefined }));
              }
            }}
            onBlur={() => {
              if (!readOnly && phoneLocal.trim() && !buildAndValidateE164Phone(dialCode, phoneLocal)) {
                setFieldErrors((current) => ({ ...current, phone: r.errors.INVALID_PHONE }));
              }
            }}
            aria-invalid={Boolean(fieldErrors.phone)}
            className={`min-h-12 min-w-0 flex-1 rounded-lg border px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 read-only:bg-slate-50 read-only:text-slate-600 ${
              fieldErrors.phone
                ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
            }`}
            placeholder={r.phonePlaceholder}
          />
        </div>
        {r.phoneHint ? <p className="mt-1.5 text-xs text-slate-500">{r.phoneHint}</p> : null}
        {fieldErrors.phone ? (
          <p className="mt-1.5 text-xs text-red-600">{fieldErrors.phone}</p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {!readOnly ? (
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600">
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
        <button
          type="submit"
          disabled={loading || !acceptedLegal}
          className="flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? r.submitting : r.submitButton}
        </button>
      ) : null}

      <p className="text-center text-xs text-slate-500">{readOnly ? r.profileHint : r.flowHint}</p>
    </form>
  );
}
