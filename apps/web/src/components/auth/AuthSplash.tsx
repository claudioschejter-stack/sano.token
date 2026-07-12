'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../generated/appVersion';

/**
 * Full-screen splash shown on mobile/PWA while the session is resolving,
 * and as the biometric gate. Uses the brand splash photo as the background.
 */
export function AuthSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div
      className={`relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <img
        src="/brand/sanova-splash-bg.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      <p
        className="absolute z-10 text-[11px] font-medium tracking-wide text-white/45"
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
