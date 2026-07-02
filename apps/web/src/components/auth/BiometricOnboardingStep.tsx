'use client';

import { PasskeyRegisterInline } from './PasskeyRegisterInline';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  onComplete: () => void | Promise<void>;
};

export function BiometricOnboardingStep({ onComplete }: Props) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Activá tu huella o Face ID</h2>
        <p className="mt-2 text-sm text-slate-600">
          Tu identidad ya fue aprobada. Configurá biometría para ingresar como en Mercado Pago, sin contraseña
          cada vez.
        </p>
      </div>

      <PasskeyRegisterInline
        variant="onboarding"
        showSkip
        onSkip={() => void onComplete()}
        onRegistered={() => void onComplete()}
      />

      <button
        type="button"
        onClick={() => void onComplete()}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
      >
        Continuar sin biometría
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
