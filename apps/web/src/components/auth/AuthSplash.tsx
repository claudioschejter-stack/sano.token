'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../generated/appVersion';

/** Full-screen splash while session resolves / biometric gate. */
export function AuthSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    document.body.classList.add('auth-splash-active');
    return () => document.body.classList.remove('auth-splash-active');
  }, []);

  return (
    <div
      className={`no-save-media relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#0e2958] transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      data-no-save
      onContextMenu={(event) => event.preventDefault()}
    >
      {/* CSS background (not <img>) so long-press cannot offer download/share. */}
      <div
        aria-hidden="true"
        data-brand-media
        className="pointer-events-none relative z-0 aspect-square w-[min(92vw,62dvh)] rounded-full bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: 'url(/brand/sanova-app-button-1024.png)' }}
      />

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
