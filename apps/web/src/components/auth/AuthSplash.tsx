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
      className={`relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0B2240] via-[#06101F] to-[#020509] px-6 transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <SplashArtwork />

      <p
        className="absolute text-[11px] font-medium tracking-wide text-slate-500"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          left: 'max(1rem, env(safe-area-inset-left))'
        }}
      >
        v{APP_VERSION}
      </p>

      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
          <img
            src="/brand/sanova-isotipo.svg"
            alt="Sanova"
            className="relative h-24 w-24 drop-shadow-[0_4px_24px_rgba(56,189,248,0.35)]"
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-2xl font-bold tracking-[0.18em] text-white">SANOVA GLOBAL</p>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
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
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="splash-line" x1="0" y1="800" x2="400" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0891B2" />
          <stop offset="0.5" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#E0F2FE" />
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
