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

type Step = 'instructions' | 'provision' | 'qr' | 'confirm' | 'backup';
type PersistedStep = 'confirm' | 'backup';

const TOTP_ONBOARDING_STORAGE_KEY = 'sanova:totp-onboarding:v1';
const TOTP_PROVISIONED_SECRET_KEY = 'sanova:totp-provisioned-secret:v1';

function clearTotpOnboardingStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(TOTP_ONBOARDING_STORAGE_KEY);
  window.sessionStorage.removeItem(TOTP_PROVISIONED_SECRET_KEY);
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
  onCopied
}: {
  secret: string;
  secretHint?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-left">
      <p className="text-sm font-semibold text-blue-950">Configuración manual (recomendada si el código no valida)</p>
      {secretHint ? (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-950 ring-1 ring-blue-200">
          Clave activa del servidor: termina en <span className="font-mono tracking-widest">{secretHint}</span>
        </p>
      ) : null}
      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-blue-900">
        <li>Eliminá todas las entradas &quot;Sanova Capital&quot; en Google Authenticator.</li>
        <li>Abrí Google Authenticator → + → Introducir clave de configuración.</li>
        <li>Cuenta: Sanova Capital · Tipo: Basada en el tiempo · Clave: (copiá abajo).</li>
        <li>Volvé acá e ingresá el código de 6 dígitos que muestra la entrada nueva.</li>
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
          aria-label="Copiar clave de configuración"
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

export function TotpOnboardingStep({ onComplete, preferConfirm = false }: Props) {
  const { isMobile } = useDeviceDetection();
  const storedStep = readStoredStep();
  const [pendingSetup, setPendingSetup] = useState(false);
  const [step, setStep] = useState<Step>(() =>
    initialTotpOnboardingStep({
      isMobile,
      storedStep
    })
  );
  const [setupUri, setSetupUri] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [setupSecretHint, setSetupSecretHint] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [provisionAttempted, setProvisionAttempted] = useState(
    shouldStartTotpOnConfirmStep({ storedStep }) || storedStep === 'confirm'
  );
  const [resettingSetup, setResettingSetup] = useState(false);
  const setupLoadedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const statusRes = await fetch('/api/auth/totp/status', { cache: 'no-store' });
      if (statusRes.ok) {
        const status = (await statusRes.json()) as { totpEnabled?: boolean; pendingSetup?: boolean };
        if (status.totpEnabled) {
          persistStep(null);
          await onCompleteRef.current();
          return;
        }

        const hasPendingSetup = Boolean(status.pendingSetup);
        setPendingSetup(hasPendingSetup);

        if (
          shouldStartTotpOnConfirmStep({
            pendingSetup: hasPendingSetup,
            storedStep
          })
        ) {
          setStep('confirm');
          setProvisionAttempted(true);
          persistStep('confirm');
        }
      }

      if (setupLoadedRef.current) {
        return;
      }
      setupLoadedRef.current = true;

      setLoadingSetup(true);
      try {
        const res = await fetch('/api/auth/totp/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = (await res.json()) as { uri?: string; secret?: string; secretHint?: string; error?: string };
        if (!cancelled && data.uri && data.secret) {
          setSetupUri(data.uri);
          setSetupSecret(data.secret);
          setSetupSecretHint(data.secretHint ?? data.secret.slice(-4));
          setPendingSetup(true);
        }
      } finally {
        if (!cancelled) {
          setLoadingSetup(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isMobile, storedStep]);

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

  function goToStep(next: Step) {
    setStep(next);
    persistStep(next === 'instructions' || next === 'provision' || next === 'qr' ? null : next);
  }

  async function loadTotpSetup(options?: { force?: boolean }) {
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
    } finally {
      setLoadingSetup(false);
    }

    return null;
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
      setConfirmError('No pudimos reiniciar el autenticador. Cerrá sesión e intentá de nuevo.');
      setResettingSetup(false);
      return;
    }

    setupLoadedRef.current = false;
    const loaded = await loadTotpSetup();
    if (loaded?.uri) {
      setStep('provision');
      setProvisionAttempted(false);
      setConfirmError('');
    } else {
      setConfirmError('No pudimos generar una clave nueva. Intentá de nuevo.');
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
    const data = (await res.json()) as { ok?: boolean; backupCodes?: string[]; error?: string };

    setConfirmLoading(false);

    if (data.ok && data.backupCodes) {
      setBackupCodes(data.backupCodes);
      clearTotpOnboardingStorage();
      goToStep('backup');
      return;
    }

    if (data.error === 'CODIGO_INCORRECTO') {
      const reloaded = await loadTotpSetup();
      const hint = reloaded?.hint ?? (setupSecretHint || setupSecret.slice(-4) || '????');
      setConfirmError(
        `Código incorrecto. En Google Authenticator debe estar la clave que termina en ${hint}. Tocá "Empezar de cero", borrá entradas viejas y pegá la clave del recuadro azul.`
      );
      setConfirmCode('');
      return;
    }

    setConfirmError(
      data.error === 'TOTP_CONFIG_INVALIDO'
        ? 'Error de configuración del servidor. Contactá soporte: la clave TOTP no pudo leerse.'
        : 'Ocurrió un error. Intentá de nuevo.'
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

  const stepIndicators: Step[] = isMobile
    ? ['provision', 'confirm', 'backup']
    : ['instructions', 'qr', 'confirm', 'backup'];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Sanova Capital en Google Authenticator</h2>
        <p className="mt-2 text-sm text-slate-600">
          {step === 'confirm' && (provisionAttempted || pendingSetup || preferConfirm)
            ? 'Ingresá el código de 6 dígitos de Sanova Capital en Google Authenticator para activar tu cuenta.'
            : isMobile
              ? 'Para proteger tu cuenta, agregá Sanova Capital en Google Authenticator y confirmá el código de 6 dígitos.'
              : 'Para proteger tu cuenta, configurá el código de 6 dígitos de Sanova Capital antes de ingresar a la plataforma.'}
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
                ? 'Preparando Sanova Capital en Google Authenticator…'
                : provisionAttempted
                  ? 'Si no se abrió la app, tocá el botón para instalar Google Authenticator y agregar Sanova Capital.'
                  : 'Abriendo Google Authenticator…'}
            </p>
            <button
              type="button"
              disabled={!setupUri || loadingSetup}
              onClick={() => syncGoogleAuthenticator()}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: MP_ACCENT }}
            >
              {loadingSetup ? 'Preparando…' : 'Abrir Google Authenticator'}
              <ChevronRight size={16} />
            </button>
            <a
              href={googleAuthenticatorStoreUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-medium text-slate-500 underline-offset-2 hover:underline"
            >
              Instalar Google Authenticator
            </a>
            {setupSecret ? <ManualTotpSetupKey secret={setupSecret} secretHint={setupSecretHint} /> : null}
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
              Ya tengo Sanova Capital en Google Authenticator
            </button>
          </div>
        ) : null}

        {step === 'instructions' ? (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Smartphone size={36} />
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Descargá Google Authenticator en tu teléfono. También funciona con Authy u otra app TOTP.
            </p>
            <button
              type="button"
              onClick={() => goToStep('qr')}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Continuar
              <ChevronRight size={16} />
            </button>
          </div>
        ) : null}

        {step === 'qr' ? (
          <div className="space-y-6">
            <p className="text-center text-sm text-slate-500">
              Escaneá el QR con Google Authenticator. La entrada aparecerá como{' '}
              <strong>Sanova Capital</strong>.
            </p>
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
                  ¿No podés escanear? Ingresá el código manualmente
                </summary>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-slate-200">
                    {setupSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(setupSecret)}
                    className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-white"
                    aria-label="Copiar secret"
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
              Ya escaneé el QR
              <ChevronRight size={16} />
            </button>
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
                {provisionAttempted || pendingSetup || preferConfirm
                  ? 'Abrí Google Authenticator, elegí la entrada Sanova Capital más reciente e ingresá el código de 6 dígitos abajo.'
                  : 'Ingresá el código de 6 dígitos de '}
                {!(provisionAttempted || pendingSetup || preferConfirm) ? (
                  <>
                    <strong>Sanova Capital</strong> en Google Authenticator.
                  </>
                ) : null}
              </p>
              {(provisionAttempted || pendingSetup) && (
                <p className="mt-2 text-xs text-amber-700">
                  Si ves más de una entrada Sanova Capital, usá la más reciente o eliminá las duplicadas e ingresá el
                  código de la que quede activa.
                </p>
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
                {loadingSetup ? 'Preparando…' : 'Abrir Google Authenticator'}
                <ChevronRight size={16} />
              </button>
            ) : null}
            {setupSecret ? <ManualTotpSetupKey secret={setupSecret} secretHint={setupSecretHint} /> : null}
            <OTPInput
              value={confirmCode}
              onChange={setConfirmCode}
              onComplete={(code) => void confirmSetup(code)}
              error={Boolean(confirmError)}
              autoFocus
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
              {confirmLoading ? 'Verificando…' : 'Activar autenticador'}
            </button>
            {isMobile ? (
              <button
                type="button"
                disabled={resettingSetup || loadingSetup}
                onClick={() => void resetTotpSetup()}
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 disabled:opacity-60"
              >
                {resettingSetup
                  ? 'Reiniciando autenticador…'
                  : 'Empezar de cero (borra clave anterior en el servidor)'}
              </button>
            ) : null}
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
              <h3 className="text-lg font-bold text-slate-900">¡2FA activado!</h3>
              <p className="mt-2 text-sm text-slate-500">
                Guardá estos códigos de recuperación en un lugar seguro.
              </p>
            </div>
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
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                type="button"
                onClick={downloadBackupCodes}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download size={14} />
                Descargar
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                persistStep(null);
                void onComplete();
              }}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <CheckCircle2 size={16} />
              Continuar a la plataforma
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
