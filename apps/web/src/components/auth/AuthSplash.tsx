'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { APP_VERSION } from '../../generated/appVersion';

/**
 * Full-screen splash shown on mobile/PWA while the session is resolving,
 * right before the login/fingerprint screen appears. Picks up visually
 * where the native OS/PWA splash (driven by manifest.json) leaves off, so
 * there's no jarring color jump between the two.
 */
export function AuthSplash() {
  const t = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div
      className={`relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#22A9E5] via-[#1278BE] via-[45%] to-[#0B2240] px-6 transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <SplashArtwork />

      <p
        className="absolute text-[11px] font-medium tracking-wide text-white/50"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          left: 'max(1rem, env(safe-area-inset-left))'
        }}
      >
        v{APP_VERSION}
      </p>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <img
          src="/brand/sanova-mark-rwa.svg"
          alt="Sanova"
          className="relative h-32 w-32 drop-shadow-[0_8px_28px_rgba(2,16,31,0.35)]"
        />

        <div className="flex flex-col items-center gap-2">
          <p className="text-3xl font-bold tracking-[0.15em] text-white drop-shadow-[0_2px_8px_rgba(2,16,31,0.35)]">
            SANOVA
          </p>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">
            {t.authSplash.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Low-opacity network-style line art, evoking a fintech/institutional mood without copying any reference asset. */
function SplashArtwork() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.22]"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="splash-line" x1="0" y1="800" x2="400" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <g stroke="url(#splash-line)" strokeWidth="1" fill="none">
        <path d="M -40 760 L 460 260" />
        <path d="M -40 820 L 460 320" />
        <path d="M -40 880 L 460 380" />
        <path d="M 40 900 L 540 400" />
        <path d="M 120 900 L 620 400" />
        <path d="M 200 900 L 700 400" />
      </g>
      <g fill="url(#splash-line)">
        <circle cx="330" cy="300" r="3" />
        <circle cx="260" cy="420" r="2.5" />
        <circle cx="380" cy="470" r="2" />
        <circle cx="190" cy="560" r="2.5" />
      </g>
    </svg>
  );
}
