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
      className={`relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_22%_16%,#7DD3FC_0%,#38BDF8_16%,#22A9E5_36%,#1278BE_62%,#0B2240_100%)] px-6 transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 30%, rgba(2,16,31,0.28) 100%)' }}
        aria-hidden="true"
      />
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

      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-44 w-44 rounded-full bg-white/25 blur-3xl" aria-hidden="true" />
          <img
            src="/brand/sanova-mark-rwa.svg"
            alt="Sanova"
            className="relative h-28 w-28 drop-shadow-[0_8px_28px_rgba(2,16,31,0.35)]"
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-2xl font-bold tracking-[0.18em] text-white drop-shadow-[0_2px_8px_rgba(2,16,31,0.35)]">
            SANOVA GLOBAL
          </p>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/80">
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
