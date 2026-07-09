'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Fingerprint,
  KeyRound,
  LogOut,
  ShieldCheck,
  ShieldOff,
  Smartphone
} from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { resetMobileLocaleOnSignOut } from '../../lib/i18n/mobileLocalePreference';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { googleAuthenticatorStoreUrl, provisionGoogleAuthenticator } from '../../lib/auth/totpAuthenticatorLink';
import { OTPInput } from './OTPInput';

type Step = 'idle' | 'instructions' | 'provision' | 'qr' | 'confirm' | 'backup';
type View = 'overview' | 'setup' | 'disable' | 'backup-codes';

type TotpStatus = {
  enabled: boolean;
  mandatory: boolean;
  loading: boolean;
};

type PasskeyStatus = {
  hasPasskeys: boolean;
  loading: boolean;
};

export function SecuritySettingsView() {
  const t = useTranslation();
  const { isMobile } = useDeviceDetection();
  const [totpStatus, setTotpStatus] = useState<TotpStatus>({ enabled: false, mandatory: false, loading: true });
  const [passkeyStatus, setPasskeyStatus] = useState<PasskeyStatus>({ hasPasskeys: false, loading: true });
  const [view, setView] = useState<View>('overview');
  const [step, setStep] = useState<Step>('idle');

  // Setup 2FA state
  const [setupUri, setSetupUri] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [provisionAttempted, setProvisionAttempted] = useState(false);
  const [justReturned, setJustReturned] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const wasHiddenRef = useRef(false);

  // Disable 2FA state
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // Check status on mount
  useEffect(() => {
    fetch('/api/auth/totp/status')
      .then((r) => r.json() as Promise<{ totpEnabled: boolean; totpMandatory?: boolean }>)
      .then(({ totpEnabled, totpMandatory }) =>
        setTotpStatus({ enabled: totpEnabled, mandatory: Boolean(totpMandatory), loading: false })
      )
      .catch(() => setTotpStatus({ enabled: false, mandatory: false, loading: false }));

    fetch('/api/auth/passkey/status')
      .then((r) => r.json() as Promise<{ hasPasskeys: boolean }>)
      .then(({ hasPasskeys }) => setPasskeyStatus({ hasPasskeys, loading: false }))
      .catch(() => setPasskeyStatus({ hasPasskeys: false, loading: false }));
  }, []);

  async function startSetup() {
    // Google Authenticator setup is desktop-only — mobile login is
    // fingerprint/passkey-only and never uses TOTP.
    if (isMobile) {
      return;
    }

    setView('setup');
    setStep('instructions');
    setConfirmCode('');
    setConfirmError('');
    setBackupCodes([]);
    setProvisionAttempted(false);
    setJustReturned(false);

    const res = await fetch('/api/auth/totp/setup', { method: 'POST' });
    const data = (await res.json()) as { uri?: string; secret?: string; error?: string };

    if (data.uri && data.secret) {
      setSetupUri(data.uri);
      setSetupSecret(data.secret);
      setStep('qr');
    }
  }

  // Kept for the (desktop-only) manual "Open Google Authenticator" link on the
  // QR/confirm steps — never auto-triggered on mobile.
  function syncGoogleAuthenticator(uri = setupUri) {
    if (!uri) {
      return;
    }

    provisionGoogleAuthenticator(uri);
    setProvisionAttempted(true);
    setJustReturned(false);
    wasHiddenRef.current = true;
    setStep('confirm');
  }

  // Detect the user coming back from Google Authenticator to refocus the code input.
  useEffect(() => {
    if (!isMobile || view !== 'setup') {
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
  }, [isMobile, view, provisionAttempted]);

  async function confirmSetup(code: string) {
    if (code.length < 6) return;
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
      const statusRes = await fetch('/api/auth/totp/status');
      const statusData = (await statusRes.json()) as { totpEnabled: boolean; totpMandatory?: boolean };
      setTotpStatus({
        enabled: statusData.totpEnabled,
        mandatory: Boolean(statusData.totpMandatory),
        loading: false
      });
      setStep('backup');
    } else {
      setConfirmError(
        data.error === 'CODIGO_INCORRECTO'
          ? 'Código incorrecto. Verificá que el reloj de tu teléfono esté sincronizado.'
          : 'Ocurrió un error. Intentá de nuevo.'
      );
      setConfirmCode('');
    }
  }

  async function disableTotp() {
    if (!disableCode || disableCode.length < 6) return;
    setDisableLoading(true);
    setDisableError('');

    const res = await fetch('/api/auth/totp/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: disableCode })
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };

    setDisableLoading(false);

    if (data.ok) {
      setTotpStatus({ enabled: false, mandatory: false, loading: false });
      setDisableCode('');
      setView('overview');
    } else if (data.error === 'TOTP_OBLIGATORIO') {
      setDisableError('El 2FA es obligatorio para cuentas con KYC aprobado y no puede desactivarse.');
      setDisableCode('');
    } else {
      setDisableError('Código incorrecto. Intentá de nuevo.');
      setDisableCode('');
    }
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

  async function handleSignOut() {
    window.localStorage.removeItem('sanova.jwt');
    resetMobileLocaleOnSignOut();
    await signOut({ callbackUrl: '/acceso' });
  }

  // --- Render ---

  if (view === 'overview') {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seguridad de la cuenta</h1>
          <p className="mt-1 text-base text-slate-500">
            Configurá métodos adicionales para proteger tu acceso.
          </p>
        </div>

        {/* Passkeys / Biometría */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Fingerprint size={24} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-900">Ingreso biométrico</h2>
              <p className="mt-1 text-sm text-slate-500">
                Face ID, Touch ID o huella dactilar — sin contraseñas.
                {passkeyStatus.hasPasskeys
                  ? ' Ya activado en tu cuenta.'
                  : ' Podés registrar una passkey desde el login en móvil o PWA.'}
              </p>
              <div className="mt-3 flex items-center gap-2">
                {passkeyStatus.loading ? (
                  <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
                ) : passkeyStatus.hasPasskeys ? (
                  <>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700">Activo</span>
                  </>
                ) : (
                  <span className="text-sm font-medium text-slate-500">No registrado</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* TOTP / Google Authenticator */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Smartphone size={24} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-900">Autenticador (Google Authenticator)</h2>
              <p className="mt-1 text-sm text-slate-500">
                Código de 6 dígitos que se renueva cada 30 segundos. Funciona sin internet.
              </p>

              {totpStatus.loading ? (
                <div className="mt-3 h-5 w-24 animate-pulse rounded bg-slate-100" />
              ) : totpStatus.enabled ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700">2FA activado</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {totpStatus.mandatory ? (
                      <p className="text-sm text-slate-600">
                        El 2FA es obligatorio para tu cuenta y no puede desactivarse.
                      </p>
                    ) : (
                      <button
                        onClick={() => setView('disable')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                      >
                        <ShieldOff size={14} />
                        Desactivar 2FA
                      </button>
                    )}
                  </div>
                </div>
              ) : isMobile ? (
                <p className="mt-4 text-sm text-slate-500">
                  Disponible solo desde la computadora. Iniciá sesión en la versión de escritorio para activarlo.
                </p>
              ) : (
                <button
                  onClick={() => void startSetup()}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
                >
                  Activar Google Authenticator
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Cerrar sesión */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            <LogOut size={18} />
            {t.nav.signOut}
          </button>
        </section>
      </div>
    );
  }

  if (view === 'disable') {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <button onClick={() => setView('overview')} className="text-sm text-slate-500 hover:text-slate-800">
          ← Volver
        </button>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <ShieldOff size={28} />
            </div>
          </div>
          <h2 className="text-center text-xl font-bold text-slate-900">Desactivar 2FA</h2>
          {totpStatus.mandatory ? (
            <p className="mt-4 text-center text-sm text-slate-600">
              El 2FA es obligatorio para cuentas con KYC aprobado y no puede desactivarse.
            </p>
          ) : (
            <>
              <p className="mt-2 text-center text-sm text-slate-500">
                Ingresá el código de Google Authenticator para confirmar.
              </p>

              <div className="mt-8 space-y-6">
                <OTPInput
                  value={disableCode}
                  onChange={setDisableCode}
                  onComplete={(code) => { setDisableCode(code); void disableTotp(); }}
                  error={Boolean(disableError)}
                  autoFocus
                  disabled={disableLoading}
                />

                {disableError ? (
                  <p className="text-center text-sm text-red-600">{disableError}</p>
                ) : null}

                <button
                  onClick={() => void disableTotp()}
                  disabled={disableLoading || disableCode.length < 6}
                  className="flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {disableLoading ? 'Verificando…' : 'Confirmar desactivación'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Setup flow
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <button onClick={() => setView('overview')} className="text-sm text-slate-500 hover:text-slate-800">
        ← Volver
      </button>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {(isMobile
          ? (['provision', 'confirm', 'backup'] as Step[])
          : (['instructions', 'qr', 'confirm', 'backup'] as Step[])
        ).map((s, i, arr) => {
          const stepIndex = arr.indexOf(step);
          const isActive = s === step;
          const isDone = i < stepIndex;
          const labels = isMobile
            ? ['Autenticador', 'Verificar', 'Guardar']
            : ['Instalar', 'Escanear', 'Verificar', 'Guardar'];
          return (
            <div key={s} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isDone ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span className={`text-xs ${isActive ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

        {/* Paso mobile: abrir Google Authenticator automaticamente */}
        {step === 'provision' && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Smartphone size={36} />
              </div>
            </div>
            <p className="text-sm text-slate-500">
              {setupUri ? 'Abriendo Google Authenticator…' : 'Preparando Sanova Capital en Google Authenticator…'}
            </p>
            <button
              type="button"
              disabled={!setupUri}
              onClick={() => syncGoogleAuthenticator()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              Abrir Google Authenticator
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
          </div>
        )}

        {/* Paso 1: Instrucciones */}
        {step === 'instructions' && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Smartphone size={36} />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Instalá Google Authenticator</h2>
              <p className="mt-2 text-sm text-slate-500">
                Descargá la app en tu teléfono si aún no la tenés. También funciona con Authy o cualquier app TOTP.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <a
                href="https://apps.apple.com/app/google-authenticator/id388497605"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                App Store (iOS)
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Google Play
              </a>
            </div>
            <button
              onClick={() => setStep('qr')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Ya la tengo instalada
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Paso 2: QR */}
        {step === 'qr' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-900">Escaneá el código QR</h2>
              <p className="mt-2 text-sm text-slate-500">
                Abrí Google Authenticator → tocá <strong>+</strong> → <strong>Escanear código QR</strong>
              </p>
            </div>

            {setupUri ? (
              <div className="flex justify-center">
                <div className="rounded-2xl border-4 border-blue-100 bg-white p-4">
                  <QRCodeSVG value={setupUri} size={200} level="M" />
                </div>
              </div>
            ) : (
              <div className="flex h-52 items-center justify-center">
                <div className="h-48 w-48 animate-pulse rounded-xl bg-slate-100" />
              </div>
            )}

            <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-600">
                ¿No podés escanear el QR? Ingresá el código manualmente
              </summary>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-slate-200">
                  {setupSecret}
                </code>
                <button
                  onClick={() => void navigator.clipboard.writeText(setupSecret)}
                  aria-label="Copiar secret"
                  className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-white"
                >
                  <Copy size={14} />
                </button>
              </div>
            </details>

            <button
              onClick={() => setStep('confirm')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Ya escaneé el QR
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Paso 3: Confirmar código */}
        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                  <KeyRound size={28} />
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Ingresá el código de verificación</h2>
              <p className="mt-2 text-sm text-slate-500">
                {justReturned
                  ? 'Volviste — ingresá el código de 6 dígitos que ves en Google Authenticator.'
                  : 'Abrí Google Authenticator e ingresá el código de 6 dígitos que muestra para Sanova Capital.'}
              </p>
            </div>

            {isMobile && setupUri ? (
              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => syncGoogleAuthenticator()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                Abrir Google Authenticator
                <ChevronRight size={16} />
              </button>
            ) : null}

            {isMobile && setupSecret ? (
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">
                  ¿No podés abrir la app? Ingresá el código manualmente
                </summary>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-slate-200">
                    {setupSecret}
                  </code>
                  <button
                    onClick={() => void navigator.clipboard.writeText(setupSecret)}
                    aria-label="Copiar secret"
                    className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-white"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </details>
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

            {confirmError ? (
              <p className="text-center text-sm text-red-600">{confirmError}</p>
            ) : null}

            <button
              onClick={() => void confirmSetup(confirmCode)}
              disabled={confirmLoading || confirmCode.length < 6}
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {confirmLoading ? 'Verificando…' : 'Activar autenticador'}
            </button>
          </div>
        )}

        {/* Paso 4: Backup codes */}
        {step === 'backup' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck size={28} />
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-900">¡2FA activado!</h2>
              <p className="mt-2 text-sm text-slate-500">
                Guardá estos códigos de recuperación en un lugar seguro. Cada uno solo se puede usar una vez.
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Códigos de recuperación
              </p>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <code key={code} className="rounded-lg bg-white px-3 py-2 text-center font-mono text-sm font-bold tracking-widest text-slate-800 ring-1 ring-amber-200">
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyBackupCodes}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={downloadBackupCodes}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download size={14} />
                Descargar .txt
              </button>
            </div>

            <button
              onClick={() => { setView('overview'); setStep('idle'); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <CheckCircle2 size={16} />
              Finalizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
