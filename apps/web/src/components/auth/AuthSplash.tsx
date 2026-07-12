'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../generated/appVersion';

/**
 * Full-screen splash shown on mobile/PWA while the session is resolving,
 * and as the biometric gate. Background uses the same diagonal gradient as
 * the logo tile so the rounded square edges disappear into the page.
 */
export function AuthSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div
      className={`relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        // Same diagonal as sanova-mark-rwa.svg tile (cyan top-right → navy bottom-left)
        background: 'linear-gradient(135deg, #0B2240 0%, #1278BE 45%, #22A9E5 100%)'
      }}
    >
      <SplashArtwork />

      <p
        className="absolute text-[11px] font-medium tracking-wide text-white/45"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          left: 'max(1rem, env(safe-area-inset-left))'
        }}
      >
        v{APP_VERSION}
      </p>

      <div className="relative z-10 flex flex-col items-center">
        <img
          src="/brand/sanova-mark-rwa.svg"
          alt="Sanova"
          className="h-56 w-56 sm:h-64 sm:w-64"
        />
      </div>
    </div>
  );
}

/** Subtle diagonal line art — sober, matches the logo mood without competing with it. */
function SplashArtwork() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="splash-line" x1="0" y1="800" x2="400" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.4" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.75" />
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
