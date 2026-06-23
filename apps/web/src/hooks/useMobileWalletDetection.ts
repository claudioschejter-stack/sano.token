/**
 * useMobileWalletDetection
 *
 * Probes deep-link scheme availability on Android Chrome (~80% accuracy via window.blur).
 * On iOS, navigator.userAgent detection still works but blur does not fire on deep-link
 * navigate-away → all iOS apps report installed:'unknown' and show "Abrir o descargar".
 */
'use client';

import { useEffect, useState } from 'react';

export type DetectedApp = {
  id: string;
  name: string;
  /** Deep link scheme to open the app */
  deepLink: string;
  /** Store URL for install fallback */
  storeUrl?: string;
  /** true = confirmed open, false = not installed, 'unknown' = iOS or untested */
  installed: boolean | 'unknown';
};

type OS = 'ios' | 'android' | 'other';

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'other';
}

// ---------------------------------------------------------------------------
// App catalogues
// ---------------------------------------------------------------------------

const FIAT_APPS_AR: DetectedApp[] = [
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    deepLink: 'mercadopago://',
    storeUrl: 'https://www.mercadopago.com.ar/app',
    installed: 'unknown'
  },
  {
    id: 'modo',
    name: 'MODO',
    deepLink: 'modo://',
    storeUrl: 'https://modo.com.ar',
    installed: 'unknown'
  },
  {
    id: 'belo',
    name: 'Belo',
    deepLink: 'belo://',
    storeUrl: 'https://belo.app',
    installed: 'unknown'
  },
  {
    id: 'lemon',
    name: 'Lemon Cash',
    deepLink: 'lemon://',
    storeUrl: 'https://lemon.me',
    installed: 'unknown'
  },
  {
    id: 'naranjax',
    name: 'NaranjaX',
    deepLink: 'naranjax://',
    storeUrl: 'https://naranjax.com',
    installed: 'unknown'
  }
];

const FIAT_APPS_GLOBAL: DetectedApp[] = [
  {
    id: 'paypal',
    name: 'PayPal',
    deepLink: 'paypal://',
    storeUrl: 'https://paypal.com/app',
    installed: 'unknown'
  },
  {
    id: 'cash_app',
    name: 'Cash App',
    deepLink: 'cashme://',
    storeUrl: 'https://cash.app',
    installed: 'unknown'
  },
  {
    id: 'venmo',
    name: 'Venmo',
    deepLink: 'venmo://',
    storeUrl: 'https://venmo.com',
    installed: 'unknown'
  }
];

const CRYPTO_APPS: DetectedApp[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    deepLink: 'metamask://',
    storeUrl: 'https://metamask.io/download',
    installed: 'unknown'
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    deepLink: 'trust://',
    storeUrl: 'https://trustwallet.com',
    installed: 'unknown'
  },
  {
    id: 'coinbase_wallet',
    name: 'Coinbase Wallet',
    deepLink: 'cbwallet://',
    storeUrl: 'https://www.coinbase.com/wallet',
    installed: 'unknown'
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    deepLink: 'rainbow://',
    storeUrl: 'https://rainbow.me',
    installed: 'unknown'
  }
];

// ---------------------------------------------------------------------------
// Deep-link probe (Android Chrome only)
// ---------------------------------------------------------------------------

function probeDeepLink(app: DetectedApp, timeoutMs = 750): Promise<DetectedApp> {
  return new Promise((resolve) => {
    const os = detectOS();

    // iOS cannot detect via blur — report unknown instantly
    if (os === 'ios' || os === 'other') {
      resolve({ ...app, installed: 'unknown' });
      return;
    }

    let opened = false;
    const onBlur = () => {
      opened = true;
    };
    window.addEventListener('blur', onBlur, { once: true });

    // Attempt deep-link navigation via iframe (avoids navigation away)
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = app.deepLink;
    document.body.appendChild(iframe);

    setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      document.body.removeChild(iframe);
      resolve({ ...app, installed: opened });
    }, timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type MobileWalletDetectionResult = {
  os: OS;
  isMobile: boolean;
  fiatApps: DetectedApp[];
  cryptoApps: DetectedApp[];
  probing: boolean;
};

export function useMobileWalletDetection(country: string): MobileWalletDetectionResult {
  const [os, setOs] = useState<OS>('other');
  const [fiatApps, setFiatApps] = useState<DetectedApp[]>([]);
  const [cryptoApps, setCryptoApps] = useState<DetectedApp[]>([]);
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    const detectedOs = detectOS();
    setOs(detectedOs);
    const mobile = detectedOs === 'ios' || detectedOs === 'android';
    if (!mobile) return;

    const fiatCatalog = country === 'AR' ? FIAT_APPS_AR : FIAT_APPS_GLOBAL;

    // iOS: just show the catalogue with installed:'unknown'
    if (detectedOs === 'ios') {
      setFiatApps(fiatCatalog.map((a) => ({ ...a, installed: 'unknown' as const })));
      setCryptoApps(CRYPTO_APPS.map((a) => ({ ...a, installed: 'unknown' as const })));
      return;
    }

    // Android: probe in parallel
    setProbing(true);
    void Promise.all([
      ...fiatCatalog.map((a) => probeDeepLink(a)),
      ...CRYPTO_APPS.map((a) => probeDeepLink(a))
    ]).then((results) => {
      setFiatApps(results.slice(0, fiatCatalog.length));
      setCryptoApps(results.slice(fiatCatalog.length));
      setProbing(false);
    });
  }, [country]);

  return {
    os,
    isMobile: os === 'ios' || os === 'android',
    fiatApps,
    cryptoApps,
    probing
  };
}
