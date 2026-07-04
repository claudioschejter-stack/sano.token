'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Fingerprint, ScanFace } from 'lucide-react';
import { usePasskeyRegistration } from '../../lib/auth/usePasskeyRegistration';
import { useTranslation } from '../../i18n/LocaleProvider';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  onComplete: () => void | Promise<void>;
};

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function BiometricOnboardingStep({ onComplete }: Props) {
  const t = useTranslation();
  const p = t.passkey;
  const isIos = useMemo(() => isIosDevice(), []);
  const Icon = isIos ? ScanFace : Fingerprint;
  const { register, loading, done, errorCode } = usePasskeyRegistration();
  const [checked, setChecked] = useState(false);

  const error = errorCode
    ? errorCode === 'NOT_SUPPORTED'
      ? p.notSupported
      : errorCode === 'CANCELLED'
        ? p.registerCancelled
        : p.registerFailed
    : null;

  async function handleToggle(next: boolean) {
    if (!next || loading || done) {
      return;
    }

    setChecked(true);
    const ok = await register({ deviceName: isIos ? 'Face ID' : 'Huella / biometría' });
    if (!ok) {
      setChecked(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Activá tu huella o Face ID</h2>
        <p className="mt-2 text-sm text-slate-600">
          Configurá biometría para ingresar como en Mercado Pago, sin contraseña cada vez.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: MP_ACCENT }}
          >
            <Icon size={24} aria-hidden />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">
              {isIos ? 'Ingreso con Face ID' : 'Ingreso con huella dactilar'}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {done
                ? 'Activado en este dispositivo'
                : loading
                  ? 'Confirmá en el diálogo de tu teléfono…'
                  : 'Deslizá para activar'}
            </p>
          </div>
          {done ? (
            <CheckCircle2 size={28} className="shrink-0 text-emerald-500" />
          ) : (
            <ToggleSwitch
              checked={checked}
              onChange={(next) => void handleToggle(next)}
              disabled={loading}
              accentColor={MP_ACCENT}
              label="Activar ingreso por biometría"
            />
          )}
        </div>
        {error ? <p className="mt-3 text-xs text-amber-700">{error}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => void onComplete()}
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-60"
      >
        {done ? 'Continuar' : 'Ahora no, ingresar con correo y contraseña'}
      </button>

      <p className="text-center text-xs text-slate-400">
        Podés activarla más tarde desde{' '}
        <span className="font-medium" style={{ color: MP_ACCENT }}>
          Perfil → Seguridad
        </span>
      </p>
    </section>
  );
}
