'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../generated/appVersion';

export type AuthSplashVariant = 'access' | 'logout' | 'loading';

type AuthSplashProps = {
  /** access = square logo top (entry); logout = round badge center (signed out); loading = access layout */
  variant?: AuthSplashVariant;
};

/** Full-screen splash while session resolves / biometric gate. */
export function AuthSplash({ variant = 'access' }: AuthSplashProps) {
  const [visible, setVisible] = useState(false);
  const mode = variant === 'loading' ? 'access' : variant;

  useEffect(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    document.body.classList.add('auth-splash-active');
    return () => document.body.classList.remove('auth-splash-active');
  }, []);

  return (
    <div
      className={`no-save-media relative flex min-h-[100dvh] w-full flex-col overflow-hidden transition-opacity duration-700 ${
        mode === 'logout' ? 'items-center justify-center bg-[#0e2958]' : 'items-center bg-[#0B2240]'
      } ${visible ? 'opacity-100' : 'opacity-0'}`}
      data-no-save
      data-auth-splash={mode}
      onContextMenu={(event) => event.preventDefault()}
    >
      {mode === 'access' ? (
        <div
          aria-hidden="true"
          data-brand-media
          className="pointer-events-none relative z-0 mt-[max(4.5rem,12dvh)] aspect-square w-[min(48vw,30dvh)] max-w-[220px] overflow-hidden rounded-[22%] bg-center bg-cover bg-no-repeat shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          style={{ backgroundImage: 'url(/brand/logo-sanova.png)' }}
        />
      ) : (
        <div
          aria-hidden="true"
          data-brand-media
          className="pointer-events-none relative z-0 aspect-square w-[min(92vw,62dvh)] rounded-full bg-center bg-cover bg-no-repeat"
          style={{ backgroundImage: 'url(/brand/sanova-app-button-1024.png)' }}
        />
      )}

      <p
        className="pointer-events-none absolute z-10 select-none text-[11px] font-medium tracking-wide text-white/45"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          left: 'max(1rem, env(safe-area-inset-left))'
        }}
      >
        v{APP_VERSION}
      </p>
    </div>
  );
}
