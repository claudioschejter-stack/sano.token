'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import {
  buildE164Phone,
  COUNTRY_DIAL_CODES,
  DEFAULT_DIAL_CODE,
  parseE164Phone
} from '../../lib/auth/countryDialCodes';
import type { OnboardingProfile } from '../../lib/onboarding/profile';
import { PasswordInput } from './PasswordInput';
import { VerificationStatusBadge } from './VerificationStatusBadge';

type RegisterFormProps = {
  /** When set, shows contact fields as read-only with onboarding data. */
  profile?: OnboardingProfile | null;
};

export function RegisterForm({ profile: profileProp }: RegisterFormProps) {
  const t = useTranslation();
  const r = t.access.register;
  const router = useRouter();
  const { data: session, status } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    void fetch('/api/onboarding/status', { cache: 'no-store' })
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (readOnly) {
      return;
    }

    setError(null);
    setDevHint(null);
    setLoading(true);

    const phone = buildE164Phone(dialCode, phoneLocal);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          phone
        })
      });

      const data = (await response.json()) as {
        error?: string;
        devCodes?: { email?: string; phone?: string };
        deliveryPending?: boolean;
      };

      if (!response.ok) {
        const key = data.error ?? 'GENERIC';
        setError(r.errors[key as keyof typeof r.errors] ?? r.errors.GENERIC);
        setLoading(false);
        return;
      }

      if (data.devCodes) {
        const parts = [];
        if (data.devCodes.email) parts.push(`Email: ${data.devCodes.email}`);
        if (data.devCodes.phone) parts.push(`SMS: ${data.devCodes.phone}`);
        const codes = parts.join(' · ');
        setDevHint(
          data.deliveryPending ? `${r.codesOnScreenHint} ${codes}` : codes
        );
      }

      const signInResult = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false
      });

      if (signInResult?.error) {
        setError(r.errors.SIGN_IN_FAILED);
        setLoading(false);
        return;
      }

      router.push('/acceso?registered=1');
    } catch {
      setError(r.errors.GENERIC);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 read-only:bg-slate-50 read-only:text-slate-600"
          placeholder={r.emailPlaceholder}
        />
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
            className="min-h-12 w-[7.5rem] shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600"
          >
            {COUNTRY_DIAL_CODES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.code}
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
            onChange={(event) => setPhoneLocal(event.target.value.replace(/\D/g, ''))}
            className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 read-only:bg-slate-50 read-only:text-slate-600"
            placeholder={r.phonePlaceholder}
          />
        </div>
      </div>

      {devHint ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {r.devCodes}: {devHint}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {!readOnly ? (
        <button
          type="submit"
          disabled={loading}
          className="flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? r.submitting : r.submitButton}
        </button>
      ) : null}

      <p className="text-center text-xs text-slate-500">{readOnly ? r.profileHint : r.flowHint}</p>
    </form>
  );
}
