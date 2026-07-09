'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, ChevronRight, Copy, Download, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { OTPInput } from './OTPInput';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import {
  googleAuthenticatorStoreUrl,
  copyTotpSetupSecret,
  provisionGoogleAuthenticator
} from '../../lib/auth/totpAuthenticatorLink';
import { initialTotpOnboardingStep, shouldStartTotpOnConfirmStep } from '../../lib/auth/totpOnboardingFlow';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';
import { InstallAppBanner } from '../pwa/InstallAppBanner';
import { useTranslation } from '../../i18n/LocaleProvider';

type Step = 'instructions' | 'provision' | 'qr' | 'confirm' | 'backup';
type PersistedStep = 'confirm' | 'backup';

const TOTP_ONBOARDING_STORAGE_KEY = 'sanova:totp-onboarding:v1';
const TOTP_PROVISIONED_SECRET_KEY = 'sanova:totp-provisioned-secret:v1';
const TOTP_BACKUP_CODES_KEY = 'sanova:totp-backup-codes:v1';

function clearTotpOnboardingStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(TOTP_ONBOARDING_STORAGE_KEY);
  window.sessionStorage.removeItem(TOTP_PROVISIONED_SECRET_KEY);
  window.sessionStorage.removeItem(TOTP_BACKUP_CODES_KEY);
}

function readStoredBackupCodes(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.sessionStorage.getItem(TOTP_BACKUP_CODES_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((code): code is string => typeof code === 'string' && code.length > 0);
  } catch {
    return [];
  }
}

function persistBackupCodes(codes: string[]) {
  if (typeof window === 'undefined' || codes.length === 0) {
    return;
  }

  window.sessionStorage.setItem(TOTP_BACKUP_CODES_KEY, JSON.stringify(codes));
}

function markProvisionedSecret(secret: string) {
  if (typeof window === 'undefined' || !secret) {
    return;
  }

  window.sessionStorage.setItem(TOTP_PROVISIONED_SECRET_KEY, secret.replace(/\s+/g, '').toUpperCase());
}

function ManualTotpSetupKey({
  secret,
  secretHint,
  onCopied,
  labels
}: {
  secret: string;
  secretHint?: string;
  onCopied?: () => void;
  labels: {
    title: string;
    activeKey: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    copyAria: string;
  };
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-left">
      <p className="text-sm font-semibold text-blue-950">{labels.title}</p>
      {secretHint ? (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-950 ring-1 ring-blue-200">
          {labels.activeKey}{' '}
          <span className="font-mono tracking-widest">{secretHint}</span>
        </p>
      ) : null}
      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-blue-900">
        <li>{labels.step1}</li>
        <li>{labels.step2}</li>
        <li>{labels.step3}</li>
        <li>{labels.step4}</li>
      </ol>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-blue-200">
          {secret.replace(/\s+/g, '').toUpperCase()}
        </code>
        <button
          type="button"
          onClick={() => {
            void copyTotpSetupSecret(secret).then((ok) => {
              if (ok) {
                markProvisionedSecret(secret);
                setCopied(true);
                onCopied?.();
                window.setTimeout(() => setCopied(false), 2000);
              }
            });
          }}
          className="shrink-0 rounded-lg border border-blue-200 bg-white p-2 text-slate-600 hover:bg-blue-50"
          aria-label={labels.copyAria}
        >
          {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

type Props = {
  onComplete: () => void | Promise<void>;
  /** Skip opening GA automatically — user already added Sanova Capital. */
  preferConfirm?: boolean;
  /** Mobile onboarding: provision GA silently for future desktop login. */
  mobileSilent?: boolean;
};

function readStoredStep(): PersistedStep | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.sessionStorage.getItem(TOTP_ONBOARDING_STORAGE_KEY);
  if (stored === 'confirm' || stored === 'backup') {
    return stored;
  }

  return null;
}

function persistStep(step: Step | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (step === 'confirm' || step === 'backup') {
    window.sessionStorage.setItem(TOTP_ONBOARDING_STORAGE_KEY, step);
    return;
  }

  window.sessionStorage.removeItem(TOTP_ONBOARDING_STORAGE_KEY);
}

export function TotpOnboardingStep({
  onComplete,
  preferConfirm = false,
  mobileSilent = false
}: Props) {
  const t = useTranslation();
  const totp = t.onboarding.totp;
  const manualLabels = {
    title: totp.manualTitle,
    activeKey: totp.manualActiveKey,
    step1: totp.manualStep1,
    step2: totp.manualStep2,
    step3: totp.manualStep3,
    step4: totp.manualStep4,
    copyAria: totp.copyKeyAria
  };
  const { isMobile } = useDeviceDetection();
  const storedStep = readStoredStep();
  const storedBackupCodes = readStoredBackupCodes();
  const [pendingSetup, setPendingSetup] = useState(false);
  const [step, setStep] = useState<Step>(() => {
    if (storedStep === 'backup') {
      return 'backup';
    }

    return initialTotpOnboardingStep({
      isMobile,
      storedStep,
      preferConfirm
    });
  });
  const [setupUri, setSetupUri] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [setupSecretHint, setSetupSecretHint] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>(() => storedBackupCodes);
  const [copied, setCopied] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [provisionAttempted, setProvisionAttempted] = useState(
    shouldStartTotpOnConfirmStep({ storedStep, preferConfirm }) || storedStep === 'confirm'
  );
  const [resettingSetup, setResettingSetup] = useState(false);
  const [justReturned, setJustReturned] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const setupInflightRef = useRef<Promise<{ uri: string; hint: string } | null> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const autoProvisionedRef = useRef(false);
  const wasHiddenRef = useRef(false);

  onCompleteRef.current = onComplete;

  async function loadTotpSetup(options?: { force?: boolean }) {
    if (setupInflightRef.current && !options?.force) {
      return setupInflightRef.current;
    }

    const request = (async () => {
      setLoadingSetup(true);
      setConfirmError('');

      try {
        const res = await fetch('/api/auth/totp/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: Boolean(options?.force) })
        });
        const data = (await res.json()) as { uri?: string; secret?: string; secretHint?: string; error?: string };

        if (data.uri && data.secret) {
          const hint = data.secretHint ?? data.secret.slice(-4);
          setSetupUri(data.uri);
          setSetupSecret(data.secret);
          setSetupSecretHint(hint);
          setPendingSetup(true);
          return { uri: data.uri, hint };
        }

        setConfirmError(data.error ? totp.configInvalid : totp.regenerateFailed);
      } catch {
        setConfirmError(totp.regenerateFailed);
      } finally {
        setLoadingSetup(false);
        setupInflightRef.current = null;
      }

      return null;
    })();

    setupInflightRef.current = request;
    return request;
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const statusRes = await fetch('/api/auth/totp/status', { cache: 'no-store' });
      if (statusRes.ok) {
        const status = (await statusRes.json()) as { totpEnabled?: boolean; pendingSetup?: boolean };
        if (status.totpEnabled) {
          const resumeBackupStep =
            storedStep === 'backup' || readStoredStep() === 'backup' || readStoredBackupCodes().length > 0;

          if (resumeBackupStep) {
            const codes = readStoredBackupCodes();
            if (codes.length > 0) {
              setBackupCodes(codes);
            }
            setStep('backup');
            persistStep('backup');
            return;
          }

          clearTotpOnboardingStorage();
          await onCompleteRef.current();
          return;
        }

        const hasPendingSetup = Boolean(status.pendingSetup);
        setPendingSetup(hasPendingSetup);

        if (
          shouldStartTotpOnConfirmStep({
            pendingSetup: hasPendingSetup,
            storedStep,
            preferConfirm
          })
        ) {
          setStep('confirm');
          setProvisionAttempted(true);
          persistStep('confirm');
        }
      }

      if (cancelled) {
        return;
      }

      await loadTotpSetup();
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isMobile, preferConfirm, storedStep]);

  useEffect(() => {
    const onPageShow = () => {
      const saved = readStoredStep();
      if (saved === 'confirm' || saved === 'backup') {
        setStep(saved);
        setProvisionAttempted(true);
      }
    };

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useEffect(() => {
    if (!isMobile || autoProvisionedRef.current) {
      return;
    }

    if (
      step === 'instructions' &&
      !shouldStartTotpOnConfirmStep({ pendingSetup, storedStep: readStoredStep() })
    ) {
      setStep('provision');
    }
  }, [isMobile, pendingSetup, step]);

  // Auto-open Google Authenticator on mobile as soon as the setup URI is ready —
  // the user doesn't have to tap "Abrir Google Authenticator" manually.
  useEffect(() => {
    if (!isMobile || autoProvisionedRef.current) {
      return;
    }

    if (step === 'provision' && setupUri && !loadingSetup) {
      autoProvisionedRef.current = true;
      syncGoogleAuthenticator(setupUri);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, step, setupUri, loadingSetup]);

  // Detect the user coming back from Google Authenticator (tab/app regains focus)
  // to surface a "welcome back" hint and refocus the 6-digit input automatically.
  useEffect(() => {
    if (!isMobile) {
      return;
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true;
        return;
      }

      if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        if (provisionAttempted) {
          setJustReturned(true);
          setFocusSignal((n) => n + 1);
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isMobile, provisionAttempted]);

  function goToStep(next: Step) {
    setStep(next);
    persistStep(next === 'instructions' || next === 'provision' || next === 'qr' ? null : next);
  }

  function syncGoogleAuthenticator(uri = setupUri) {
    if (!uri) {
      return;
    }

    if (setupSecret) {
      markProvisionedSecret(setupSecret);
    }

    persistStep('confirm');
    provisionGoogleAuthenticator(uri);
    setProvisionAttempted(true);
    setJustReturned(false);
    wasHiddenRef.current = true;
    goToStep('confirm');
  }

  async function resetTotpSetup() {
    setResettingSetup(true);
    setConfirmCode('');
    setConfirmError('');
    clearTotpOnboardingStorage();

    const resetRes = await fetch('/api/auth/totp/reset-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!resetRes.ok) {
      setConfirmError(totp.resetFailed);
      setResettingSetup(false);
      return;
    }

    const loaded = await loadTotpSetup({ force: true });
    if (loaded?.uri) {
      setStep('provision');
      setProvisionAttempted(false);
      setConfirmError('');
    } else {
      setConfirmError(totp.regenerateFailed);
    }

    setResettingSetup(false);
  }

  async function confirmSetup(code: string) {
    if (code.length < 6) {
      return;
    }

    setConfirmLoading(true);
    setConfirmError('');

    const res = await fetch('/api/auth/totp/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = (await res.json()) as {
      ok?: boolean;
      backupCodes?: string[];
      error?: string;
      secretHint?: string;
    };

    setConfirmLoading(false);

    if (data.ok && data.backupCodes) {
      setBackupCodes(data.backupCodes);
      persistBackupCodes(data.backupCodes);
      goToStep('backup');
      return;
    }

    if (data.error === 'CODIGO_INCORRECTO') {
      const reloaded = await loadTotpSetup();
      const serverHint = data.secretHint ?? reloaded?.hint;
      const uiHint = setupSecretHint || setupSecret.slice(-4);
      const hint = serverHint ?? uiHint ?? '????';
      if (serverHint && uiHint && serverHint !== uiHint) {
        setSetupSecretHint(serverHint);
      }
      setConfirmError(
        `${totp.wrongCodePrefix} ${hint}${
          uiHint && serverHint && uiHint !== serverHint ? ` ${totp.wrongCodeUiMismatch} ${uiHint})` : ''
        }. ${totp.wrongCodeSuffix}`
      );
      setConfirmCode('');
      return;
    }

    setConfirmError(
      data.error === 'TOTP_CONFIG_INVALIDO'
        ? totp.configInvalid
        : totp.genericError
    );
    setConfirmCode('');
  }

  function copyBackupCodes() {
    void navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadBackupCodes() {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sanova-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  const [mobileSilentBusy, setMobileSilentBusy] = useState(false);
  const [mobileSilentError, setMobileSilentError] = useState('');
  const [mobileSilentUri, setMobileSilentUri] = useState('');

  useEffect(() => {
    if (!mobileSilent || autoProvisionedRef.current) {
      return;
    }

    autoProvisionedRef.current = true;
    setMobileSilentBusy(true);

    void fetch('/api/onboarding/provision-mobile-totp', { method: 'POST', credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data: { uri?: string; error?: string }) => {
        if (data.uri) {
          setMobileSilentUri(data.uri);
          if (isMobile) {
            void provisionGoogleAuthenticator(data.uri);
          }
        } else if (data.error) {
          setMobileSilentError(totp.regenerateFailed);
        }
      })
      .catch(() => setMobileSilentError(totp.regenerateFailed))
      .finally(() => setMobileSilentBusy(false));
  }, [isMobile, mobileSilent, totp.regenerateFailed]);

  if (mobileSilent) {
    return (
      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{totp.mobileSilentTitle}</h2>
          <p className="mt-2 text-sm text-slate-600">{totp.mobileSilentDesc}</p>
        </div>
        {mobileSilentError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {mobileSilentError}
          </p>
        ) : null}
        {mobileSilentUri && isMobile ? (
          <button
            type="button"
            onClick={() => void provisionGoogleAuthenticator(mobileSilentUri)}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800"
          >
            {totp.openGoogleAuthenticator}
          </button>
        ) : null}
        <InstallAppBanner />
        <button
          type="button"
          disabled={mobileSilentBusy}
          onClick={() => void onComplete()}
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-base font-semibold text-white disabled:opacity-60"
        >
          {mobileSilentBusy ? totp.verifying : totp.mobileSilentContinue}
        </button>
      </section>
    );
  }

  const stepIndicators: Step[] = isMobile
    ? ['provision', 'confirm', 'backup']
    : ['instructions', 'qr', 'confirm', 'backup'];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{totp.title}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {step === 'confirm' && (provisionAttempted || pendingSetup || preferConfirm)
            ? totp.descConfirm
            : isMobile
              ? totp.descMobile
              : totp.descDesktop}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {stepIndicators.map((s, i) => {
          const stepIndex = stepIndicators.indexOf(step === 'qr' ? 'provision' : step);
          const isActive = s === step || (step === 'qr' && s === 'provision');
          const isDone = i < stepIndex;
          return (
            <div key={s} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
                style={isActive && !isDone ? { backgroundColor: MP_ACCENT } : undefined}
              >
                {isDone ? <CheckCircle2 size={16} /> : i + 1}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ring-1 ring-slate-100">
        {step === 'provision' ? (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl text-white"
                style={{ backgroundColor: MP_ACCENT }}
              >
                <Smartphone size={36} />
              </div>
            </div>
            <p className="text-sm text-slate-600">
              {loadingSetup
                ? totp.preparing
                : provisionAttempted
                  ? totp.openGaFallback
                  : totp.openingGa}
            </p>
            <button
              type="button"
              disabled={!setupUri || loadingSetup}
              onClick={() => syncGoogleAuthenticator()}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: MP_ACCENT }}
            >
              {loadingSetup ? totp.preparingShort : totp.openGa}
              <ChevronRight size={16} />
            </button>
            <a
              href={googleAuthenticatorStoreUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-medium text-slate-500 underline-offset-2 hover:underline"
            >
              {totp.installGa}
            </a>
            {setupSecret ? (
              <ManualTotpSetupKey secret={setupSecret} secretHint={setupSecretHint} labels={manualLabels} />
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (setupUri) {
                  syncGoogleAuthenticator();
                  return;
                }
                setProvisionAttempted(true);
                goToStep('confirm');
              }}
              className="block w-full text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
            >
              {totp.alreadyHaveGa}
            </button>
            {confirmError ? <p className="text-center text-sm text-red-600">{confirmError}</p> : null}
          </div>
        ) : null}

        {step === 'instructions' ? (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Smartphone size={36} />
              </div>
            </div>
            <p className="text-sm text-slate-500">{totp.instructionsDesc}</p>
            <button
              type="button"
              onClick={() => goToStep('qr')}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {totp.continue}
              <ChevronRight size={16} />
            </button>
          </div>
        ) : null}

        {step === 'qr' ? (
          <div className="space-y-6">
            <p className="text-center text-sm text-slate-500">{totp.qrDesc}</p>
            {loadingSetup || !setupUri ? (
              <div className="flex h-52 items-center justify-center">
                <div className="h-48 w-48 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="rounded-2xl border-4 border-blue-100 bg-white p-4">
                  <QRCodeSVG value={setupUri} size={200} level="M" />
                </div>
              </div>
            )}
            {setupSecret ? (
              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">
                  {totp.manualScanTitle}
                </summary>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-slate-200">
                    {setupSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(setupSecret)}
                    className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-white"
                    aria-label={totp.copySecretAria}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </details>
            ) : null}
            <button
              type="button"
              onClick={() => goToStep('confirm')}
              disabled={!setupUri}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {totp.scannedQr}
              <ChevronRight size={16} />
            </button>
            {confirmError ? <p className="text-center text-sm text-red-600">{confirmError}</p> : null}
          </div>
        ) : null}

        {step === 'confirm' ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                  <KeyRound size={28} />
                </div>
              </div>
              <p className="text-sm text-slate-500">
                {justReturned
                  ? totp.welcomeBack
                  : provisionAttempted || pendingSetup || preferConfirm
                    ? totp.enterCodeHint
                    : totp.enterCodeDefaultPrefix}{' '}
                {!justReturned && !(provisionAttempted || pendingSetup || preferConfirm) ? (
                  <>
                    <strong>Sanova Capital</strong> {totp.enterCodeDefaultSuffix}
                  </>
                ) : null}
              </p>
              {(provisionAttempted || pendingSetup) && (
                <p className="mt-2 text-xs text-amber-700">{totp.duplicateHint}</p>
              )}
            </div>
            {isMobile && setupUri ? (
              <button
                type="button"
                disabled={loadingSetup || resettingSetup}
                onClick={() => syncGoogleAuthenticator()}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: MP_ACCENT }}
              >
                {loadingSetup ? totp.preparingShort : totp.openGa}
                <ChevronRight size={16} />
              </button>
            ) : null}
            {setupSecret ? (
              <ManualTotpSetupKey secret={setupSecret} secretHint={setupSecretHint} labels={manualLabels} />
            ) : null}
            <OTPInput
              value={confirmCode}
              onChange={(value) => {
                setConfirmCode(value);
                if (value) {
                  setJustReturned(false);
                }
              }}
              onComplete={(code) => void confirmSetup(code)}
              error={Boolean(confirmError)}
              autoFocus
              focusSignal={focusSignal}
              disabled={confirmLoading}
            />
            {confirmError ? <p className="text-center text-sm text-red-600">{confirmError}</p> : null}
            <button
              type="button"
              onClick={() => void confirmSetup(confirmCode)}
              disabled={confirmLoading || confirmCode.length < 6}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: MP_ACCENT }}
            >
              {confirmLoading ? totp.verifying : totp.activate}
            </button>
            <button
              type="button"
              disabled={resettingSetup || loadingSetup}
              onClick={() => void resetTotpSetup()}
              className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 disabled:opacity-60"
            >
              {resettingSetup ? totp.resetting : totp.resetCta}
            </button>
          </div>
        ) : null}

        {step === 'backup' ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck size={28} />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{totp.backupTitle}</h3>
              <p className="mt-2 text-sm text-slate-500">{totp.backupDesc}</p>
            </div>
            <InstallAppBanner />
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <code
                    key={code}
                    className="rounded-lg bg-white px-3 py-2 text-center font-mono text-sm font-bold tracking-widest text-slate-800 ring-1 ring-amber-200"
                  >
                    {code}
                  </code>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={copyBackupCodes}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? totp.copied : totp.copy}
              </button>
              <button
                type="button"
                onClick={downloadBackupCodes}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download size={14} />
                {totp.download}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                clearTotpOnboardingStorage();
                void onComplete();
              }}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <CheckCircle2 size={16} />
              {totp.continuePlatform}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
