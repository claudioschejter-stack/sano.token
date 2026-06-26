'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ShieldCheck, X } from 'lucide-react';
import { OTPInput } from './OTPInput';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';

export function TOTPVerificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get('t') ?? '';
  const callbackUrl = searchParams.get('callbackUrl') ?? '/acceso/callback';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBackupInput, setShowBackupInput] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedSeconds, setLockedSeconds] = useState<number | null>(null);

  async function verify(opts: { code?: string; backupCode?: string }) {
    if (loading) return;
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/totp/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, ...opts })
    });

    const data = (await res.json()) as {
      loginToken?: string;
      error?: string;
      remainingAttempts?: number;
      remainingSeconds?: number;
    };

    if (!res.ok || !data.loginToken) {
      setLoading(false);
      setCode('');
      setBackupCode('');

      if (data.remainingSeconds) {
        setLockedSeconds(data.remainingSeconds);
        setError(`Cuenta bloqueada por ${Math.ceil(data.remainingSeconds / 60)} min por demasiados intentos fallidos.`);
      } else {
        setRemainingAttempts(data.remainingAttempts ?? null);
        setError(
          data.remainingAttempts != null
            ? `Código incorrecto. Te quedan ${data.remainingAttempts} intento${data.remainingAttempts !== 1 ? 's' : ''}.`
            : 'Código incorrecto o expirado.'
        );
      }
      return;
    }

    // loginToken válido → crear sesión via NextAuth passkey provider
    const result = await signIn('passkey', {
      loginToken: data.loginToken,
      redirect: false
    });

    if (result?.error) {
      setLoading(false);
      setError('Error al crear la sesión. Intentá de nuevo.');
      return;
    }

    await waitForAccessToken();
    router.push(callbackUrl);
  }

  if (!tempToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <X className="mx-auto mb-3 text-red-500" size={32} />
          <p className="font-semibold text-red-700">Sesión inválida</p>
          <p className="mt-1 text-sm text-slate-500">Volvé al inicio de sesión para intentar de nuevo.</p>
          <a href="/acceso" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
            Ir al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ShieldCheck size={28} />
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Verificación de seguridad</h1>
            <p className="mt-2 text-sm text-slate-500">
              {showBackupInput
                ? 'Ingresá uno de tus códigos de recuperación.'
                : 'Abrí Google Authenticator e ingresá el código de 6 dígitos.'}
            </p>
          </div>

          {lockedSeconds ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
              {error}
            </div>
          ) : showBackupInput ? (
            /* Backup code input */
            <div className="space-y-4">
              <input
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                placeholder="XXXXX-XXXXX"
                className="min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                disabled={loading}
              />
              {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
              <button
                onClick={() => void verify({ backupCode })}
                disabled={loading || backupCode.length < 5}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {loading ? 'Verificando…' : 'Usar código de recuperación'}
              </button>
              <button
                onClick={() => { setShowBackupInput(false); setError(null); }}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-800"
              >
                ← Volver al código del autenticador
              </button>
            </div>
          ) : (
            /* TOTP input */
            <div className="space-y-6">
              <OTPInput
                value={code}
                onChange={setCode}
                onComplete={(val) => void verify({ code: val })}
                error={Boolean(error)}
                autoFocus
                disabled={loading}
              />

              {error ? (
                <p className="text-center text-sm text-red-600">{error}</p>
              ) : remainingAttempts != null ? (
                <p className="text-center text-xs text-amber-600">
                  {remainingAttempts} intento{remainingAttempts !== 1 ? 's' : ''} restante{remainingAttempts !== 1 ? 's' : ''}
                </p>
              ) : null}

              <button
                onClick={() => void verify({ code })}
                disabled={loading || code.length < 6}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {loading ? 'Verificando…' : 'Confirmar'}
              </button>

              <button
                onClick={() => { setShowBackupInput(true); setError(null); setCode(''); }}
                className="w-full text-center text-sm text-slate-500 transition hover:text-slate-800"
              >
                Usar código de recuperación
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          ¿Problemas para acceder?{' '}
          <a href="/contacto" className="font-medium text-blue-600 hover:underline">
            Contactar soporte
          </a>
        </p>
      </div>
    </div>
  );
}
